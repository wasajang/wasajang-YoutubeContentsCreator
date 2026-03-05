// VrewClipList — 클립 카드 리스트 (클립별 그룹핑) + 일괄·클립 이미지/영상 생성 버튼
import React, { useRef, useEffect, useMemo } from 'react';
import { Image, Video } from 'lucide-react';
import type { EditorClip } from './types';
import VrewClipCard from './VrewClipCard';

interface VrewClipListProps {
  clips: EditorClip[];
  currentClipIndex: number;
  currentTime: number;
  onClipSelect: (index: number) => void;
  onSplitAtWord: (clipIndex: number, globalWordIndex: number) => void;
  onMergeWithPrev: (clipIndex: number) => void;
  onDelete: (clipIndex: number) => void;
  onGenerateImage: (clipId: string) => void;
  onGenerateVideo: (clipId: string) => void;
  onGenerateSceneImage: (sceneId: string) => void;
  onGenerateSceneVideo: (sceneId: string) => void;
  onGenerateAllImages: () => void;
  onGenerateAllVideos: () => void;
  clipGenStatus: Record<string, string>;
  clipVideoGenStatus: Record<string, string>;
}

/** 클립 그룹 (sceneId 기준) */
interface SceneGroup {
  sceneId: string;
  clips: { clip: EditorClip; globalIndex: number }[];
}

const VrewClipList: React.FC<VrewClipListProps> = ({
  clips,
  currentClipIndex,
  currentTime,
  onClipSelect,
  onSplitAtWord,
  onMergeWithPrev,
  onDelete,
  onGenerateImage,
  onGenerateVideo,
  onGenerateSceneImage,
  onGenerateSceneVideo,
  onGenerateAllImages,
  onGenerateAllVideos,
  clipGenStatus,
  clipVideoGenStatus,
}) => {
  // 선택된 클립 자동 스크롤
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = cardRefs.current[currentClipIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentClipIndex]);

  // sceneId 기준으로 클립 그룹핑 (순서 유지)
  const sceneGroups = useMemo<SceneGroup[]>(() => {
    const groups: SceneGroup[] = [];
    const seen = new Map<string, number>(); // sceneId → groups 배열의 index

    clips.forEach((clip, idx) => {
      const sid = clip.sceneId || 'unknown';
      if (seen.has(sid)) {
        groups[seen.get(sid)!].clips.push({ clip, globalIndex: idx });
      } else {
        seen.set(sid, groups.length);
        groups.push({ sceneId: sid, clips: [{ clip, globalIndex: idx }] });
      }
    });

    return groups;
  }, [clips]);

  // 일괄 버튼 레이블 계산
  const missingImageCount = clips.filter((c) => !c.imageUrl).length;
  const missingVideoCount = clips.filter(
    (c) => c.imageUrl && !c.isVideoEnabled
  ).length;

  // 현재 일괄 생성 중인지
  const isAnyImageGenerating = clips.some(
    (c) => clipGenStatus[c.id] === 'generating'
  );
  const isAnyVideoGenerating = clips.some(
    (c) => clipVideoGenStatus[c.id] === 'generating'
  );

  if (clips.length === 0) {
    return (
      <div className="vrew-clip-list vrew-clip-list--empty">
        <p className="vrew-clip-list__empty-msg">클립이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="vrew-clip-list">
      {/* 헤더 */}
      <div className="vrew-clip-list__header">
        <span className="vrew-clip-list__title">Vrew Editor</span>
        <span className="vrew-clip-list__count">
          클립 그룹 {sceneGroups.length}개 · 전체 {clips.length}개
        </span>
      </div>

      {/* 일괄 생성 버튼 */}
      <div className="vrew-clip-list__bulk-actions">
        <button
          className={[
            'vrew-clip-list__bulk-btn',
            isAnyImageGenerating ? 'vrew-clip-list__bulk-btn--loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateAllImages}
          disabled={isAnyImageGenerating || missingImageCount === 0}
          title={
            missingImageCount === 0
              ? '모든 클립에 이미지가 있습니다'
              : `이미지 없는 클립 ${missingImageCount}개 일괄 생성`
          }
        >
          <Image size={14} />
          {isAnyImageGenerating
            ? '생성 중...'
            : missingImageCount > 0
            ? `이미지 ${missingImageCount}개 생성`
            : '이미지 완료'}
        </button>

        <button
          className={[
            'vrew-clip-list__bulk-btn',
            isAnyVideoGenerating ? 'vrew-clip-list__bulk-btn--loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateAllVideos}
          disabled={isAnyVideoGenerating || missingVideoCount === 0}
          title={
            missingVideoCount === 0
              ? '모든 클립에 영상이 있거나 이미지가 없습니다'
              : `영상 없는 클립 ${missingVideoCount}개 일괄 생성`
          }
        >
          <Video size={14} />
          {isAnyVideoGenerating
            ? '생성 중...'
            : missingVideoCount > 0
            ? `영상 ${missingVideoCount}개 생성`
            : '영상 완료'}
        </button>
      </div>

      {/* 클립 카드 목록 — 클립 그룹별 정렬 */}
      <div className="vrew-clip-list__cards">
        {sceneGroups.map((group, sceneIdx) => {
          const hasSceneImage = group.clips.some((c) => c.clip.imageUrl);
          const isSceneImageGenerating = group.clips.some(
            (c) => clipGenStatus[c.clip.id] === 'generating'
          );
          const isSceneVideoGenerating = group.clips.some(
            (c) => clipVideoGenStatus[c.clip.id] === 'generating'
          );

          return (
            <div key={group.sceneId} className="vrew-scene-group">
              {/* 클립 그룹 헤더 */}
              <div className="vrew-scene-group__header">
                <span className="vrew-scene-group__label">
                  그룹 {String(sceneIdx + 1).padStart(2, '0')}
                </span>
                <span className="vrew-scene-group__clip-count">
                  {group.clips.length}개 클립
                </span>
                <div className="vrew-scene-group__actions">
                  <button
                    className={[
                      'vrew-scene-group__btn',
                      isSceneImageGenerating ? 'vrew-scene-group__btn--loading' : '',
                      hasSceneImage ? 'vrew-scene-group__btn--done' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onGenerateSceneImage(group.sceneId)}
                    disabled={isSceneImageGenerating}
                    title="그룹 전체에 동일 이미지 생성"
                  >
                    <Image size={12} />
                    {isSceneImageGenerating ? '...' : hasSceneImage ? '그룹 이미지 ✓' : '그룹 이미지'}
                  </button>
                  <button
                    className={[
                      'vrew-scene-group__btn',
                      isSceneVideoGenerating ? 'vrew-scene-group__btn--loading' : '',
                      !hasSceneImage ? 'vrew-scene-group__btn--disabled' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onGenerateSceneVideo(group.sceneId)}
                    disabled={isSceneVideoGenerating || !hasSceneImage}
                    title={!hasSceneImage ? '이미지를 먼저 생성하세요' : '그룹 전체에 동일 영상 생성'}
                  >
                    <Video size={12} />
                    {isSceneVideoGenerating ? '...' : '그룹 영상'}
                  </button>
                </div>
              </div>

              {/* 그룹 내 클립 카드들 */}
              {group.clips.map(({ clip, globalIndex }) => (
                <div
                  key={clip.id}
                  ref={(el) => {
                    cardRefs.current[globalIndex] = el;
                  }}
                >
                  <VrewClipCard
                    clip={clip}
                    index={globalIndex}
                    isActive={globalIndex === currentClipIndex}
                    currentTime={currentTime}
                    onSelect={() => onClipSelect(globalIndex)}
                    onSplitAtWord={(wordIdx) => onSplitAtWord(globalIndex, wordIdx)}
                    onMergeWithPrev={() => onMergeWithPrev(globalIndex)}
                    onDelete={() => onDelete(globalIndex)}
                    onGenerateImage={() => onGenerateImage(clip.id)}
                    onGenerateVideo={() => onGenerateVideo(clip.id)}
                    isGeneratingImage={clipGenStatus[clip.id] === 'generating'}
                    isGeneratingVideo={clipVideoGenStatus[clip.id] === 'generating'}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VrewClipList;
