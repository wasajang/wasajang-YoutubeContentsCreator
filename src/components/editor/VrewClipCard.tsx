// VrewClipCard — Vrew 스타일 클립 카드 (가로 2영역: 내용 + 썸네일)
import React from 'react';
import { Volume2, AlignJustify, Pencil, Play, Image, Plus } from 'lucide-react';
import type { EditorClip } from './types';
import VrewClipTokens from './VrewClipTokens';

interface VrewClipCardProps {
  clip: EditorClip;
  index: number;
  isActive: boolean;
  currentTime: number;
  onSelect: () => void;
  onSplitAtWord: (globalWordIndex: number) => void;
  onMergeWithPrev: () => void;
  onDelete: () => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  // 신규
  appliedImageUrl?: string;
  onAddAsset?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const VrewClipCard: React.FC<VrewClipCardProps> = ({
  clip,
  index,
  isActive,
  currentTime,
  onSelect,
  onSplitAtWord,
  onMergeWithPrev: _onMergeWithPrev,
  onDelete: _onDelete,
  onGenerateImage: _onGenerateImage,
  onGenerateVideo: _onGenerateVideo,
  isGeneratingImage = false,
  isGeneratingVideo = false,
  appliedImageUrl,
  onAddAsset,
  onContextMenu,
}) => {
  // sentences에서 모든 단어 평탄화
  const words = clip.sentences.flatMap((s) => s.words ?? []);
  const hasWords = words.length > 0;

  const clipNum = String(index + 1).padStart(2, '0');
  const startLabel = formatTime(clip.audioStartTime);
  const durationLabel = clip.duration.toFixed(2);

  // 썸네일: appliedImageUrl 우선, 없으면 clip.imageUrl
  const thumbUrl = appliedImageUrl || clip.imageUrl;

  // 로딩 중 표시
  const isGenerating = isGeneratingImage || isGeneratingVideo;

  return (
    <div
      className={[
        'vrew-clip-card',
        isActive ? 'vrew-clip-card--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-clip-id={clip.id}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      aria-label={`클립 ${clipNum} 선택`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* 왼쪽: 클립 내용 */}
      <div className="vrew-clip-card__content">
        {/* 상단 행: 번호 + 보이스 + 드래그핸들 + 토큰 + 편집 아이콘 */}
        <div className="vrew-clip-card__header">
          <span className="vrew-clip-card__num">{clipNum}</span>
          <span className="vrew-clip-card__voice">
            <Volume2 size={10} />
            Fish-기본
          </span>
          <AlignJustify size={12} className="vrew-clip-card__drag-handle" />

          {/* 단어 토큰 or 텍스트 폴백 */}
          <div className="vrew-clip-card__tokens-wrap">
            {hasWords ? (
              <VrewClipTokens
                words={words}
                currentTime={currentTime}
                clipAudioStart={clip.audioStartTime}
                clipAudioEnd={clip.audioEndTime}
                onSplitAfterWord={onSplitAtWord}
              />
            ) : (
              <span className="vrew-clip-card__text-fallback">
                {clip.text || '(텍스트 없음)'}
              </span>
            )}
          </div>

          <button
            className="vrew-clip-card__edit-btn"
            title="편집"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu?.(e);
            }}
          >
            <Pencil size={11} />
          </button>
        </div>

        {/* 하단 행: ▶ + 자막 텍스트 */}
        <div className="vrew-clip-card__subtitle-row">
          <Play size={10} className="vrew-clip-card__play-icon" />
          <span className="vrew-clip-card__subtitle-text">{clip.text}</span>
        </div>

        {/* 생성 중 인디케이터 */}
        {isGenerating && (
          <div className="vrew-clip-card__generating">
            {isGeneratingImage ? '이미지 생성 중...' : '영상 생성 중...'}
          </div>
        )}
      </div>

      {/* 오른쪽: 썸네일 + 시간 */}
      <div className="vrew-clip-card__thumb-col">
        <div className="vrew-clip-card__thumb">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={`클립 ${clipNum} 썸네일`}
              className="vrew-clip-card__thumb-img"
            />
          ) : (
            <div className="vrew-clip-card__thumb-empty">
              <Image size={16} />
              {/* 045: 빈 클립에 에셋 추가 버튼 */}
              {onAddAsset && (
                <button
                  className="vrew-clip-card__thumb-add-btn"
                  onClick={(e) => { e.stopPropagation(); onAddAsset(); }}
                  title="에셋 추가"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        <span className="vrew-clip-card__time">
          {startLabel}
        </span>
        <span className="vrew-clip-card__time">
          + {durationLabel}초
        </span>
      </div>
    </div>
  );
};

export default VrewClipCard;
