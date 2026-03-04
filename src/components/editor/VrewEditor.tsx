/**
 * VrewEditor — Vrew 스타일 편집기 메인 컨테이너
 *
 * 3단 레이아웃:
 *   상단: 미리보기(60%) + 대본 패널(40%)
 *   중간: 재생 컨트롤 + 편집 도구
 *   하단: 3트랙 타임라인 (영상/음성/자막)
 *
 * 시네마틱 + 나레이션 양쪽 모드 지원
 */
import React, { useState, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { NarrationClip } from '../../store/projectStore';
import { useEditorPlayback } from '../../hooks/useEditorPlayback';
import {
  scenesToEditorClips,
  narrationToEditorClips,
  editorClipsToNarration,
  type EditorClip,
} from './types';
import { splitClip, mergeClips } from '../../utils/narration-sync';
import EditorPreview from './EditorPreview';
import ScriptPanel from './ScriptPanel';
import EditorTimeline from './EditorTimeline';
import EditorControls from './EditorControls';

interface VrewEditorProps {
  onNext?: () => void;
  onPrev?: () => void;
}

/** EditorClip → NarrationClip 변환 (narration-sync 유틸 호환) */
function toNarrationClip(c: EditorClip): NarrationClip {
  return {
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
  };
}

/** 클립 배열의 label + order 재정렬 */
function relabel(clips: EditorClip[]): EditorClip[] {
  return clips.map((c, i) => ({
    ...c,
    order: i,
    label: `씬 ${String(i + 1).padStart(2, '0')}`,
  }));
}

const VrewEditor: React.FC<VrewEditorProps> = ({ onNext, onPrev }) => {
  const mode = useProjectStore((s) => s.mode);
  const scenes = useProjectStore((s) => s.scenes);
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
  const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);

  // 시네마틱 모드: 로컬 클립 상태
  const [cinematicClips, setCinematicClips] = useState<EditorClip[]>(() =>
    scenesToEditorClips(scenes)
  );

  // 통합 클립 배열
  const clips =
    mode === 'narration'
      ? narrationToEditorClips(narrationClips)
      : cinematicClips;

  const audioUrl = mode === 'narration' ? narrativeAudioUrl : '';

  const {
    currentClipIndex,
    isPlaying,
    currentTime,
    totalDuration,
    togglePlay,
    seekToClip,
  } = useEditorPlayback({ clips, audioUrl });

  const currentClip = clips[currentClipIndex] ?? null;

  // 클립 업데이트 (모드별 분기)
  const updateClips = useCallback(
    (updated: EditorClip[]) => {
      if (mode === 'narration') {
        setNarrationClips(editorClipsToNarration(updated));
      } else {
        setCinematicClips(updated);
      }
    },
    [mode, setNarrationClips]
  );

  // 대본 텍스트 편집
  const handleTextChange = useCallback(
    (clipId: string, text: string) => {
      const updated = clips.map((c) =>
        c.id === clipId ? { ...c, text } : c
      );
      updateClips(updated);
    },
    [clips, updateClips]
  );

  // 자르기 — 문장 중간점에서 분할
  const handleSplit = useCallback(() => {
    const clip = clips[currentClipIndex];
    if (!clip || clip.sentences.length < 2) return;

    const splitIndex = Math.floor(clip.sentences.length / 2) - 1;
    try {
      const [a, b] = splitClip(toNarrationClip(clip), splitIndex);
      const clipA: EditorClip = { ...a, label: '' };
      const clipB: EditorClip = { ...b, label: '' };
      const updated = [...clips];
      updated.splice(currentClipIndex, 1, clipA, clipB);
      updateClips(relabel(updated));
    } catch (err) {
      console.error('[VrewEditor] split 실패:', err);
    }
  }, [clips, currentClipIndex, updateClips]);

  // 합치기 — 이전 클립과 병합
  const handleMerge = useCallback(() => {
    if (currentClipIndex <= 0) return;
    const a = clips[currentClipIndex - 1];
    const b = clips[currentClipIndex];
    const merged = mergeClips(toNarrationClip(a), toNarrationClip(b));
    const mergedClip: EditorClip = { ...merged, label: '' };
    const updated = [...clips];
    updated.splice(currentClipIndex - 1, 2, mergedClip);
    updateClips(relabel(updated));
  }, [clips, currentClipIndex, updateClips]);

  // 삭제
  const handleDelete = useCallback(() => {
    if (clips.length <= 1) return;
    const updated = clips.filter((_, i) => i !== currentClipIndex);
    updateClips(relabel(updated));
  }, [clips, currentClipIndex, updateClips]);

  // 앞으로 이동
  const handleMoveUp = useCallback(() => {
    if (currentClipIndex <= 0) return;
    const updated = [...clips];
    [updated[currentClipIndex - 1], updated[currentClipIndex]] = [
      updated[currentClipIndex],
      updated[currentClipIndex - 1],
    ];
    updateClips(relabel(updated));
    seekToClip(currentClipIndex - 1);
  }, [clips, currentClipIndex, updateClips, seekToClip]);

  // 뒤로 이동
  const handleMoveDown = useCallback(() => {
    if (currentClipIndex >= clips.length - 1) return;
    const updated = [...clips];
    [updated[currentClipIndex], updated[currentClipIndex + 1]] = [
      updated[currentClipIndex + 1],
      updated[currentClipIndex],
    ];
    updateClips(relabel(updated));
    seekToClip(currentClipIndex + 1);
  }, [clips, currentClipIndex, updateClips, seekToClip]);

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, clips.length, seekToClip]);

  const canSplit = currentClip ? currentClip.sentences.length >= 2 : false;
  const canMerge = currentClipIndex > 0;
  const canDelete = clips.length > 1;

  if (clips.length === 0) {
    return (
      <div className="vrew-editor vrew-editor--empty">
        <p>편집할 씬이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="vrew-editor">
      {/* 상단: 미리보기 + 대본 패널 */}
      <div className="vrew-editor__main">
        <div className="vrew-editor__preview-area">
          <EditorPreview
            clip={currentClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        </div>
        <div className="vrew-editor__script-area">
          <ScriptPanel
            clips={clips}
            currentClipIndex={currentClipIndex}
            onClipSelect={seekToClip}
            onTextChange={handleTextChange}
          />
        </div>
      </div>

      {/* 중간: 컨트롤 */}
      <EditorControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        totalDuration={totalDuration}
        currentClipIndex={currentClipIndex}
        clipCount={clips.length}
        hasAudio={Boolean(audioUrl)}
        onTogglePlay={togglePlay}
        onPrev={handlePrevClip}
        onNext={handleNextClip}
        onSplit={handleSplit}
        onMerge={handleMerge}
        onDelete={handleDelete}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        canSplit={canSplit}
        canMerge={canMerge}
        canDelete={canDelete}
      />

      {/* 하단: 타임라인 */}
      <EditorTimeline
        clips={clips}
        currentClipIndex={currentClipIndex}
        currentTime={currentTime}
        totalDuration={totalDuration}
        onClipSelect={seekToClip}
      />

      {/* 네비게이션 */}
      {(onPrev || onNext) && (
        <div className="vrew-editor__nav">
          {onPrev && (
            <button className="btn-secondary" onClick={onPrev}>
              이전
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onNext && (
            <button className="btn-primary" onClick={onNext}>
              다음 &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VrewEditor;
