/**
 * NarrationSceneList — 씬 카드 리스트 + 편집 도구
 *
 * - 씬 카드 클릭 → onClipSelect(index) → NarrationPreview 업데이트
 * - 순서 변경: ↑/↓ 버튼으로 clips 배열 순서 교체
 * - 나누기: splitClip (문장이 2개 이상인 경우만 활성)
 * - 합치기: mergeClips (index > 0일 때만)
 * - 삭제: removeClip (최소 1개 유지)
 */
import React, { useCallback } from 'react';
import { ArrowUp, ArrowDown, Scissors, Merge, Trash2 } from 'lucide-react';
import type { NarrationClip } from '../../store/projectStore';
import {
  splitClip,
  mergeClips,
  removeClip,
  reorderClips,
  getTotalDuration,
} from '../../utils/narration-sync';

interface NarrationSceneListProps {
  clips: NarrationClip[];
  currentClipIndex: number;
  onClipSelect: (index: number) => void;
  onClipsChange: (clips: NarrationClip[]) => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const NarrationSceneList: React.FC<NarrationSceneListProps> = ({
  clips,
  currentClipIndex,
  onClipSelect,
  onClipsChange,
}) => {
  const totalDuration = getTotalDuration(clips);

  // 순서 변경: ↑
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const updated = [...clips];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onClipsChange(reorderClips(updated));
      onClipSelect(index - 1);
    },
    [clips, onClipsChange, onClipSelect]
  );

  // 순서 변경: ↓
  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= clips.length - 1) return;
      const updated = [...clips];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onClipsChange(reorderClips(updated));
      onClipSelect(index + 1);
    },
    [clips, onClipsChange, onClipSelect]
  );

  // 나누기: 첫 번째 문장 이후 지점에서 분할
  const handleSplit = useCallback(
    (index: number) => {
      const clip = clips[index];
      if (!clip || clip.sentences.length < 2) return;

      const splitIndex = Math.floor(clip.sentences.length / 2) - 1;
      try {
        const [clipA, clipB] = splitClip(clip, splitIndex);
        const updated = [...clips];
        updated.splice(index, 1, clipA, clipB);
        onClipsChange(reorderClips(updated));
      } catch (err) {
        console.error('[NarrationSceneList] splitClip 실패:', err);
      }
    },
    [clips, onClipsChange]
  );

  // 합치기: 위 씬과 병합
  const handleMergeWithPrev = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const merged = mergeClips(clips[index - 1], clips[index]);
      const updated = [...clips];
      updated.splice(index - 1, 2, merged);
      onClipsChange(reorderClips(updated));
      onClipSelect(index - 1);
    },
    [clips, onClipsChange, onClipSelect]
  );

  // 삭제
  const handleDelete = useCallback(
    (index: number) => {
      if (clips.length <= 1) return;
      const clip = clips[index];
      const updated = removeClip(clips, clip.id);
      onClipsChange(updated);
      onClipSelect(Math.max(0, index - 1));
    },
    [clips, onClipsChange, onClipSelect]
  );

  return (
    <div className="narration-scene-list">
      {/* 헤더 */}
      <div className="narration-scene-list__header">
        <span>씬 {clips.length}개</span>
        {totalDuration > 0 && (
          <span>총 {formatTime(totalDuration)}</span>
        )}
      </div>

      {/* 씬 카드 목록 */}
      <div className="narration-scene-list__items">
        {clips.map((clip, index) => {
          const isActive = index === currentClipIndex;
          const canSplit = clip.sentences.length >= 2;
          const canMerge = index > 0;
          const canDelete = clips.length > 1;

          return (
            <div
              key={clip.id}
              className={`narration-scene-list__card${isActive ? ' narration-scene-list__card--active' : ''}`}
              onClick={() => onClipSelect(index)}
            >
              {/* 썸네일 */}
              <div className="narration-scene-list__card-thumb">
                {clip.imageUrl ? (
                  <img src={clip.imageUrl} alt={`씬 ${index + 1} 썸네일`} />
                ) : (
                  <div className="narration-scene-list__card-thumb-placeholder">
                    {index + 1}
                  </div>
                )}
              </div>

              {/* 텍스트 */}
              <div className="narration-scene-list__card-text">
                <span className="narration-scene-list__card-label">
                  씬 {index + 1}
                  <span className="narration-scene-list__card-duration">
                    {clip.duration.toFixed(1)}s
                  </span>
                </span>
                <p className="narration-scene-list__card-excerpt">
                  {clip.text.length > 60 ? clip.text.slice(0, 60) + '...' : clip.text}
                </p>
              </div>

              {/* 액션 버튼 */}
              <div
                className="narration-scene-list__card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="narration-scene-list__action-btn"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title="위로"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  className="narration-scene-list__action-btn"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === clips.length - 1}
                  title="아래로"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  className="narration-scene-list__action-btn"
                  onClick={() => handleMergeWithPrev(index)}
                  disabled={!canMerge}
                  title="위 씬과 합치기"
                >
                  <Merge size={12} />
                </button>
                <button
                  className="narration-scene-list__action-btn"
                  onClick={() => handleSplit(index)}
                  disabled={!canSplit}
                  title="나누기"
                >
                  <Scissors size={12} />
                </button>
                <button
                  className="narration-scene-list__action-btn narration-scene-list__action-btn--danger"
                  onClick={() => handleDelete(index)}
                  disabled={!canDelete}
                  title="삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NarrationSceneList;
