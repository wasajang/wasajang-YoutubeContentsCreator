/**
 * useProject — 프로젝트 자동 동기화 훅
 *
 * Dual-mode 아키텍처:
 *   - 게스트 모드 (Supabase 미설정): 아무것도 안 함 → localStorage만 사용
 *   - 로그인 모드: Zustand store 변경 감지 → 디바운스 2초 → Supabase 자동 저장
 *
 * 기능:
 *   1. 로그인 시 최근 프로젝트 DB에서 로드
 *   2. 첫 로그인 마이그레이션: localStorage → Supabase 푸시
 *   3. 디바운스 자동 저장 (store 변경 → 2초 후 DB 저장)
 *   4. 무한 루프 방지 (isLoadingFromDb 플래그)
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useProjectStore } from '../store/projectStore';
import { isSupabaseConfigured } from '../services/supabase';
import { saveProject, loadProject, listProjects } from '../services/project-api';
import { saveCards, loadCards } from '../services/card-api';

const SAVE_DEBOUNCE_MS = 2000;

export function useProject() {
    const { user, isGuest } = useAuth();
    const store = useProjectStore();

    const isLoadingFromDbRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasMigratedRef = useRef(false);

    // ── 1. 로그인 시 초기 로드 + 마이그레이션 ──
    useEffect(() => {
        if (isGuest || !user || !isSupabaseConfigured) return;
        if (isLoadingFromDbRef.current) return;

        const initFromDb = async () => {
            isLoadingFromDbRef.current = true;
            try {
                // 내 프로젝트 목록 조회
                const projects = await listProjects(user.id);

                if (projects.length > 0) {
                    // DB에 프로젝트가 있으면 → 최근 프로젝트 로드
                    const latest = projects[0];
                    const result = await loadProject(latest.id);
                    if (result) {
                        store.setProjectId(latest.id);
                        store.setTitle(result.project.title);
                        store.setSelectedStyle(result.project.selected_style);
                        store.setAspectRatio(result.project.aspect_ratio);
                        if (result.scenes.length > 0) {
                            store.setScenes(result.scenes);
                        }
                        console.log(`[useProject] DB에서 프로젝트 로드: "${result.project.title}"`);
                    }

                    // 카드도 로드
                    const cards = await loadCards(user.id);
                    if (cards.length > 0) {
                        // store의 기존 카드와 병합 (DB 우선)
                        cards.forEach((card) => store.addToCardLibrary(card));
                        console.log(`[useProject] DB에서 카드 ${cards.length}개 로드`);
                    }
                } else if (store.hasActiveProject && !hasMigratedRef.current) {
                    // DB 비어있고 localStorage에 데이터가 있으면 → 마이그레이션
                    hasMigratedRef.current = true;
                    console.log('[useProject] 첫 로그인 마이그레이션: localStorage → Supabase');

                    try {
                        const newId = await saveProject({
                            projectId: null,
                            userId: user.id,
                            title: store.title,
                            selectedStyle: store.selectedStyle,
                            aspectRatio: store.aspectRatio,
                            scenes: store.scenes,
                        });
                        store.setProjectId(newId);

                        if (store.cardLibrary.length > 0) {
                            await saveCards(user.id, store.cardLibrary);
                        }
                        console.log(`[useProject] 마이그레이션 완료 (projectId: ${newId})`);
                    } catch (err) {
                        console.error('[useProject] 마이그레이션 실패:', err);
                    }
                }
            } catch (err) {
                console.error('[useProject] 초기 로드 실패:', err);
            } finally {
                // 약간의 딜레이 후 플래그 해제 (디바운스 내 store 변경 무시)
                setTimeout(() => {
                    isLoadingFromDbRef.current = false;
                }, 500);
            }
        };

        initFromDb();
    }, [user, isGuest]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 2. 디바운스 자동 저장 ──
    const debouncedSave = useCallback(() => {
        if (isGuest || !user || !isSupabaseConfigured) return;
        if (isLoadingFromDbRef.current) return;

        // 기존 타이머 취소
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(async () => {
            const state = useProjectStore.getState();
            if (!state.hasActiveProject) return;

            try {
                const newId = await saveProject({
                    projectId: state.projectId,
                    userId: user.id,
                    title: state.title,
                    selectedStyle: state.selectedStyle,
                    aspectRatio: state.aspectRatio,
                    scenes: state.scenes,
                });

                // projectId 업데이트 (새 프로젝트인 경우)
                if (!state.projectId && newId) {
                    isLoadingFromDbRef.current = true;
                    state.setProjectId(newId);
                    setTimeout(() => { isLoadingFromDbRef.current = false; }, 300);
                }

                // 카드도 저장
                await saveCards(user.id, state.cardLibrary);
            } catch (err) {
                console.error('[useProject] 자동 저장 실패:', err);
            }
        }, SAVE_DEBOUNCE_MS);
    }, [user, isGuest]);

    // store 변경 감지 → 디바운스 저장 트리거
    useEffect(() => {
        if (isGuest || !user || !isSupabaseConfigured) return;
        if (isLoadingFromDbRef.current) return;

        debouncedSave();
    }, [
        store.title,
        store.scenes,
        store.selectedStyle,
        store.aspectRatio,
        store.cardLibrary,
        store.hasActiveProject,
        debouncedSave,
        isGuest,
        user,
    ]);

    // 타이머 클린업
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);
}
