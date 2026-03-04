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

/** 시네마틱 Scene[] → EditorClip[] 변환 */
export function scenesToEditorClips(scenes: Scene[]): EditorClip[] {
  let acc = 0;
  return scenes.map((s, i) => {
    const duration = 5;
    const clip: EditorClip = {
      id: `editor-${s.id}`,
      sceneId: s.id,
      text: s.text,
      sentences: [{
        index: 0,
        text: s.text,
        startTime: acc,
        endTime: acc + duration,
      }],
      imageUrl: s.imageUrl || '',
      videoUrl: s.videoUrl || '',
      isVideoEnabled: Boolean(s.videoUrl),
      effect: 'none',
      audioStartTime: acc,
      audioEndTime: acc + duration,
      duration,
      order: i,
      label: `씬 ${String(i + 1).padStart(2, '0')}`,
    };
    acc += duration;
    return clip;
  });
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
