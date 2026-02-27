/**
 * 프로젝트 + 씬 CRUD API (Supabase)
 *
 * Supabase가 설정되지 않으면 모든 함수가 에러를 throw합니다.
 * 호출 전에 `isSupabaseConfigured`를 확인하세요.
 *
 * NOTE: DB 타입 정의(database.ts)와 Supabase 클라이언트 간 타입 불일치로
 * insert/update에 `as any` 단언을 사용합니다 (MVP 단계).
 */
import { supabase } from './supabase';
import type { Scene } from '../store/projectStore';
import type { DbProject } from '../types/database';

// ── 타입 변환 헬퍼 (Store ↔ DB) ──

/** Store Scene → DB Insert 포맷 */
function sceneToDb(scene: Scene, projectId: string, order: number) {
    return {
        project_id: projectId,
        scene_order: order,
        text: scene.text,
        location: scene.location,
        camera_angle: scene.cameraAngle,
        image_url: scene.imageUrl || null,
        video_url: null,
        video_count: 1,
        seed_card_ids: scene.characters || [],
        status: scene.status || 'pending',
        image_prompt: null,
        video_prompt: null,
    };
}

/** DB Row → Store Scene 포맷 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToScene(row: any): Scene {
    return {
        id: row.id,
        text: row.text,
        location: row.location,
        cameraAngle: row.camera_angle,
        imageUrl: row.image_url || '',
        characters: row.seed_card_ids || [],
        status: row.status || 'pending',
        checked: false,
    };
}

// ── Public API ──

export interface SaveProjectParams {
    projectId: string | null;
    userId: string;
    title: string;
    selectedStyle: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    scenes: Scene[];
}

/**
 * 프로젝트 저장 (upsert)
 * - projectId가 있으면 UPDATE, 없으면 INSERT
 * - 씬은 delete+reinsert 방식 (MVP)
 * @returns 저장된 projectId
 */
export async function saveProject(params: SaveProjectParams): Promise<string> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    const { projectId, userId, title, selectedStyle, aspectRatio, scenes } = params;

    let finalProjectId: string;

    if (projectId) {
        finalProjectId = projectId;
        // UPDATE 기존 프로젝트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('projects') as any)
            .update({
                title,
                selected_style: selectedStyle,
                aspect_ratio: aspectRatio,
                status: 'in_progress',
            })
            .eq('id', finalProjectId);

        if (error) throw new Error(`프로젝트 업데이트 실패: ${error.message}`);
    } else {
        // INSERT 새 프로젝트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('projects') as any)
            .insert({
                user_id: userId,
                title,
                selected_style: selectedStyle,
                aspect_ratio: aspectRatio,
                status: 'in_progress',
            })
            .select('id')
            .single();

        if (error || !data) throw new Error(`프로젝트 생성 실패: ${error?.message}`);
        finalProjectId = data.id;
    }

    // 씬 저장: 기존 삭제 후 재삽입
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('scenes') as any).delete().eq('project_id', finalProjectId);

    if (scenes.length > 0) {
        const sceneRows = scenes.map((s, i) => sceneToDb(s, finalProjectId, i));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: sceneError } = await (supabase.from('scenes') as any).insert(sceneRows);
        if (sceneError) {
            console.error('[project-api] 씬 저장 실패:', sceneError);
        }
    }

    console.log(`[project-api] 프로젝트 저장 완료: ${finalProjectId} (${scenes.length}개 씬)`);
    return finalProjectId;
}

/**
 * 프로젝트 로드 (project + scenes)
 */
export async function loadProject(projectId: string): Promise<{
    project: DbProject;
    scenes: Scene[];
} | null> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project, error } = await (supabase.from('projects') as any)
        .select('*')
        .eq('id', projectId)
        .single();

    if (error || !project) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sceneRows } = await (supabase.from('scenes') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('scene_order', { ascending: true });

    const scenes = (sceneRows || []).map(dbToScene);

    return { project, scenes };
}

/**
 * 내 프로젝트 목록 (최신순)
 */
export async function listProjects(userId: string): Promise<DbProject[]> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('projects') as any)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) throw new Error(`프로젝트 목록 조회 실패: ${error.message}`);
    return data || [];
}

/**
 * 프로젝트 삭제 (FK cascade로 씬도 자동 삭제)
 */
export async function deleteProject(projectId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('projects') as any)
        .delete()
        .eq('id', projectId);

    if (error) throw new Error(`프로젝트 삭제 실패: ${error.message}`);
    console.log(`[project-api] 프로젝트 삭제 완료: ${projectId}`);
}
