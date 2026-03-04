// VrewClipCard — 개별 클립 카드 (Vrew 스타일 레이아웃: 토큰 + 자막 + 썸네일 + 버튼)
import React from 'react';
import { Image, Video, Scissors, Trash2 } from 'lucide-react';
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
  onMergeWithPrev,
  onDelete,
  onGenerateImage,
  onGenerateVideo,
  isGeneratingImage = false,
  isGeneratingVideo = false,
}) => {
  // sentences에서 모든 단어 평탄화
  const words = clip.sentences.flatMap((s) => s.words ?? []);
  const hasWords = words.length > 0;

  // 생성 완료 상태
  const hasImage = Boolean(clip.imageUrl);
  const hasVideo = Boolean(clip.videoUrl);

  const clipLabel = String(index + 1).padStart(2, '0');
  const startLabel = formatTime(clip.audioStartTime);
  const endLabel = formatTime(clip.audioEndTime);
  const durationLabel = clip.duration.toFixed(1);

  return (
    <div
      className={[
        'vrew-clip-card',
        isActive ? 'vrew-clip-card--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-clip-id={clip.id}
    >
      {/* 헤더: 클립 번호, 시간 범위, 삭제 버튼 */}
      <div
        className="vrew-clip-card__header"
        role="button"
        tabIndex={0}
        aria-label={`클립 ${clipLabel} 선택`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <span className="vrew-clip-card__label">클립 [{clipLabel}]</span>
        <span className="vrew-clip-card__time">
          {startLabel} — {endLabel}
        </span>
        <span className="vrew-clip-card__duration">지속: {durationLabel}s</span>
        <div className="vrew-clip-card__header-actions">
          <button
            className="vrew-clip-card__btn-delete"
            title="클립 삭제"
            aria-label="클립 삭제"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 토큰 영역 */}
      <div className="vrew-clip-card__tokens">
        {hasWords ? (
          <VrewClipTokens
            words={words}
            currentTime={currentTime}
            clipAudioStart={clip.audioStartTime}
            clipAudioEnd={clip.audioEndTime}
            onSplitAfterWord={onSplitAtWord}
          />
        ) : (
          <div className="vrew-clip-card__text-fallback">
            {clip.text || '(텍스트 없음)'}
          </div>
        )}
      </div>

      {/* 자막 + 썸네일 */}
      <div className="vrew-clip-card__body">
        <div className="vrew-clip-card__subtitle">
          <p className="vrew-clip-card__subtitle-text">{clip.text}</p>
        </div>
        <div className="vrew-clip-card__thumbnail">
          {clip.imageUrl ? (
            <img
              src={clip.imageUrl}
              alt={`클립 ${clipLabel} 썸네일`}
              className="vrew-clip-card__thumbnail-img"
            />
          ) : (
            <div className="vrew-clip-card__thumbnail-empty">
              <Image size={24} />
            </div>
          )}
          {clip.isVideoEnabled && clip.videoUrl && (
            <span className="vrew-clip-card__video-badge" title="영상 있음">
              <Video size={10} />
            </span>
          )}
        </div>
      </div>

      {/* 버튼 바 */}
      <div className="vrew-clip-card__actions">
        <button
          className={[
            'vrew-clip-card__btn',
            isGeneratingImage ? 'vrew-clip-card__btn--loading' : '',
            hasImage ? 'vrew-clip-card__btn--done' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateImage}
          disabled={isGeneratingImage}
          title={hasImage ? '이미지 재생성' : '이미지 생성'}
        >
          <Image size={14} />
          {isGeneratingImage ? '생성 중...' : hasImage ? '이미지 완료 ✓' : '이미지 생성'}
        </button>

        <button
          className={[
            'vrew-clip-card__btn',
            isGeneratingVideo ? 'vrew-clip-card__btn--loading' : '',
            hasVideo ? 'vrew-clip-card__btn--done' : '',
            !clip.imageUrl ? 'vrew-clip-card__btn--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateVideo}
          disabled={isGeneratingVideo || !clip.imageUrl}
          title={!clip.imageUrl ? '이미지 먼저 생성하세요' : hasVideo ? '영상 재생성' : '영상 생성'}
        >
          <Video size={14} />
          {isGeneratingVideo ? '생성 중...' : hasVideo ? '영상 완료 ✓' : '영상 생성'}
        </button>

        {index > 0 && (
          <button
            className="vrew-clip-card__btn vrew-clip-card__btn--merge"
            onClick={onMergeWithPrev}
            title="이전 클립과 합치기"
          >
            <Scissors size={14} />
            합치기
          </button>
        )}
      </div>
    </div>
  );
};

export default VrewClipCard;
