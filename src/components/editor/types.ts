/**
 * editor/types.ts — Vrew 편집기 공통 타입 + 시네마틱↔나레이션 데이터 변환
 */
import type { Scene, NarrationClip, SentenceTiming } from '../../store/projectStore';

/** 편집기 통합 클립 타입 (시네마틱 + 나레이션 양쪽 호환) */
export interface EditorClip {
  id: string;
  sceneId: string;
  text: string;
  sentences: SentenceTiming[];
  imageUrl: string;
  videoUrl: string;
  isVideoEnabled: boolean;
  effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  audioStartTime: number;
  audioEndTime: number;
  duration: number;
  order: number;
  label: string;
  audioUrl?: string; // 클립별 TTS (시네마틱 모드)
  isEdited?: boolean; // 타임라인에서 자르기/순서변경 시 true → 재생성 잠금
}

/** 독립 음성 아이템 (시네마틱 모드 타임라인) */
export interface AudioItem {
  id: string;
  startTime: number;
  endTime: number;
  audioUrl: string;
  text: string;
}

/** 독립 자막 아이템 (시네마틱 모드 타임라인) */
export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

/** 에셋 적용 범위 — 하나의 이미지/영상이 여러 클립에 걸쳐 적용 (Vrew 스타일) */
export interface MediaRange {
  id: string;
  type: 'image' | 'video';
  url: string;
  startClipIndex: number;       // 적용 시작 클립 인덱스 (0-based)
  endClipIndex: number;         // 적용 끝 클립 인덱스 (inclusive)
  videoStartOffset?: number;    // 비디오 시작점 오프셋 (초)
  sceneId?: string;             // 원본 씬 ID
}

/** 시네마틱 Scene[] → EditorClip[] 변환 (서브씬 확장 지원) */
export function scenesToEditorClips(
  scenes: Scene[],
  sceneDurations?: Record<string, number>,
  videoCountPerScene?: Record<string, number>,
  sceneImages?: Record<string, string[]>,
  sceneVideos?: Record<string, string[]>,
): EditorClip[] {
  let acc = 0;
  const clips: EditorClip[] = [];
  let order = 0;

  scenes.forEach((s, sceneIdx) => {
    const vc = videoCountPerScene?.[s.id] || 1;

    for (let sub = 0; sub < vc; sub++) {
      const duration = sceneDurations?.[`${s.id}-${sub}`] ?? sceneDurations?.[s.id] ?? 5;
      const imageUrl = sceneImages?.[s.id]?.[sub] || (sub === 0 ? (s.imageUrl || '') : '');
      const videoUrl = sceneVideos?.[s.id]?.[sub] || (sub === 0 ? (s.videoUrl || '') : '');

      clips.push({
        id: `editor-${s.id}-${sub}`,
        sceneId: s.id,
        text: sub === 0 ? s.text : `(파트 ${sub + 1})`,
        sentences: [{
          index: 0,
          text: sub === 0 ? s.text : `(파트 ${sub + 1})`,
          startTime: acc,
          endTime: acc + duration,
        }],
        imageUrl,
        videoUrl,
        isVideoEnabled: Boolean(videoUrl),
        effect: 'none',
        audioStartTime: acc,
        audioEndTime: acc + duration,
        duration,
        order: order++,
        label: vc > 1
          ? `씬 ${String(sceneIdx + 1).padStart(2, '0')}-${sub + 1}`
          : `씬 ${String(sceneIdx + 1).padStart(2, '0')}`,
      });
      acc += duration;
    }
  });

  return clips;
}

/** NarrationClip[] → EditorClip[] 변환 */
export function narrationToEditorClips(clips: NarrationClip[]): EditorClip[] {
  return clips.map((c, i) => ({
    id: c.id,
    sceneId: c.sceneId,
    text: c.text,
    sentences: c.sentences,
    imageUrl: c.imageUrl,
    videoUrl: c.videoUrl,
    isVideoEnabled: c.isVideoEnabled,
    effect: c.effect,
    audioStartTime: c.audioStartTime,
    audioEndTime: c.audioEndTime,
    duration: c.duration,
    order: c.order,
    label: `씬 ${String(i + 1).padStart(2, '0')}`,
  }));
}

/** EditorClip[] → NarrationClip[] (store 저장용) */
export function editorClipsToNarration(clips: EditorClip[]): NarrationClip[] {
  return clips.map((c) => ({
    id: c.id,
    sceneId: c.sceneId,
    text: c.text,
    sentences: c.sentences,
    imageUrl: c.imageUrl,
    videoUrl: c.videoUrl,
    isVideoEnabled: c.isVideoEnabled,
    effect: c.effect,
    audioStartTime: c.audioStartTime,
    audioEndTime: c.audioEndTime,
    duration: c.duration,
    order: c.order,
    isModified: false,
  }));
}
