// VrewClipList — 클립 카드 리스트 + 일괄 이미지/영상 생성 버튼
import React, { useRef, useEffect } from 'react';
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
  onGenerateAllImages: () => void;
  onGenerateAllVideos: () => void;
  clipGenStatus: Record<string, string>;
  clipVideoGenStatus: Record<string, string>;
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
        <span className="vrew-clip-list__count">클립 {clips.length}개</span>
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

      {/* 클립 카드 목록 */}
      <div className="vrew-clip-list__cards">
        {clips.map((clip, idx) => (
          <div
            key={clip.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
          >
            <VrewClipCard
              clip={clip}
              index={idx}
              isActive={idx === currentClipIndex}
              currentTime={currentTime}
              onSelect={() => onClipSelect(idx)}
              onSplitAtWord={(wordIdx) => onSplitAtWord(idx, wordIdx)}
              onMergeWithPrev={() => onMergeWithPrev(idx)}
              onDelete={() => onDelete(idx)}
              onGenerateImage={() => onGenerateImage(clip.id)}
              onGenerateVideo={() => onGenerateVideo(clip.id)}
              isGeneratingImage={clipGenStatus[clip.id] === 'generating'}
              isGeneratingVideo={clipVideoGenStatus[clip.id] === 'generating'}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VrewClipList;
