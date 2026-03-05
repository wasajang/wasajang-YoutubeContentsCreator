/**
 * ClipDetailPanel — 타임라인 우측 클립 상세 패널
 *
 * 선택된 씬의:
 * - 설정값 그리드 (비율, 스타일, 캐스트, 시작이미지)
 * - 이미지 프롬프트 (편집 가능 + 이미지 재생성)
 * - 영상 프롬프트 (편집 가능 + 영상 재생성)
 */
import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { artStyles } from '../../data/artStyles';
import type { EditorClip } from './types';
import type { AssetCard } from '../../store/projectStore';

const DURATION_OPTIONS = [5, 6, 8, 10, 15];

interface ClipDetailPanelProps {
  clip: EditorClip | null;
  aspectRatio: string;
  artStyleId: string;
  videoPrompt: string;
  imagePrompt: string;
  onVideoPromptChange: (value: string) => void;
  onImagePromptChange?: (value: string) => void;
  isRegenerating: boolean;
  onRegenerateVideo: () => void;
  isRegeneratingImage?: boolean;
  onRegenerateImage?: () => void;
  sceneImageUrl: string;
  castNames: string[];
  isEdited?: boolean;
  onDurationChange?: (duration: number) => void;
  // 캐스트 카드 선택기
  availableCards?: AssetCard[];
  selectedCardIds?: string[];
  onToggleCard?: (cardId: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const ClipDetailPanel: React.FC<ClipDetailPanelProps> = ({
  clip,
  aspectRatio,
  artStyleId,
  videoPrompt,
  imagePrompt,
  onVideoPromptChange,
  onImagePromptChange,
  isRegenerating,
  onRegenerateVideo,
  isRegeneratingImage = false,
  onRegenerateImage,
  sceneImageUrl,
  castNames,
  isEdited = false,
  onDurationChange,
  availableCards,
  selectedCardIds,
  onToggleCard,
}) => {
  if (!clip) {
    return (
      <div className="clip-detail">
        <div className="clip-detail__placeholder">클립을 선택하세요</div>
      </div>
    );
  }

  const artStyle = artStyles.find((s) => s.id === artStyleId);

  return (
    <div className="clip-detail">
      {/* 헤더 */}
      <div className="clip-detail__header">
        <span className="clip-detail__scene-label">{clip.label}</span>
        {onDurationChange ? (
          <select
            className="clip-detail__duration-select"
            value={clip.duration}
            onChange={(e) => onDurationChange(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}초</option>
            ))}
          </select>
        ) : (
          <span className="clip-detail__time">{formatTime(clip.duration)}</span>
        )}
      </div>

      {/* 설정값 그리드 (항상 펼침) */}
      <div className="clip-detail__settings-grid">
        <div className="clip-detail__setting-card">
          <span className="clip-detail__setting-label">비율</span>
          <span className="clip-detail__setting-value">{aspectRatio}</span>
        </div>
        <div className="clip-detail__setting-card">
          <span className="clip-detail__setting-label">아트스타일</span>
          <span className="clip-detail__setting-value">{artStyle?.nameKo || artStyleId}</span>
        </div>
        <div className="clip-detail__setting-card">
          <span className="clip-detail__setting-label">시작 이미지</span>
          <div className="clip-detail__setting-thumb">
            {sceneImageUrl ? (
              <img src={sceneImageUrl} alt="시드 이미지" />
            ) : (
              <div className="clip-detail__thumb-placeholder">
                아직 이미지가 없습니다
              </div>
            )}
          </div>
        </div>
        {/* 캐스트 카드 선택기 */}
        {availableCards && availableCards.length > 0 && onToggleCard ? (
          <div className="clip-detail__setting-card clip-detail__setting-card--full">
            <span className="clip-detail__setting-label">캐스트 (클릭하여 선택/해제)</span>
            <div className="clip-detail__cast-picker">
              {availableCards.map((card) => {
                const isSelected = selectedCardIds?.includes(card.id) ?? false;
                return (
                  <button
                    key={card.id}
                    className={`clip-detail__cast-chip${isSelected ? ' clip-detail__cast-chip--selected' : ''}`}
                    onClick={() => onToggleCard(card.id)}
                    title={card.description || card.name}
                  >
                    {card.imageUrl && (
                      <img src={card.imageUrl} alt={card.name} className="clip-detail__cast-chip-img" />
                    )}
                    <span className="clip-detail__cast-chip-name">{card.name}</span>
                    {isSelected && <X size={8} className="clip-detail__cast-chip-x" />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : castNames.length > 0 ? (
          <div className="clip-detail__setting-card">
            <span className="clip-detail__setting-label">캐스트</span>
            <div className="clip-detail__setting-tags">
              {castNames.map((name) => (
                <span key={name} className="clip-detail__tag">{name}</span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="clip-detail__setting-card clip-detail__setting-card--full">
          <span className="clip-detail__setting-label">대본</span>
          <span className="clip-detail__setting-value clip-detail__setting-value--text">
            {clip.text.substring(0, 50)}{clip.text.length > 50 ? '...' : ''}
          </span>
        </div>
      </div>

      {/* 이미지 프롬프트 (편집 가능 + 재생성) */}
      <div className="clip-detail__section">
        <div className="clip-detail__section-title">이미지 프롬프트</div>
        <textarea
          className="clip-detail__prompt-area"
          value={imagePrompt}
          onChange={(e) => onImagePromptChange?.(e.target.value)}
          readOnly={!onImagePromptChange}
          rows={2}
          placeholder="이미지 생성에 사용될 프롬프트..."
        />
        {isEdited && (
          <div className="clip-detail__edited-notice">타임라인에서 편집되어 재생성이 잠겼습니다</div>
        )}
        {onRegenerateImage && (
          <button
            className="clip-detail__regen-btn clip-detail__regen-btn--image"
            onClick={onRegenerateImage}
            disabled={isRegeneratingImage || !imagePrompt.trim() || isEdited}
          >
            <RefreshCw size={14} className={isRegeneratingImage ? 'spin' : ''} />
            {isEdited ? '편집됨 — 재생성 불가' : isRegeneratingImage ? '이미지 생성 중...' : '이미지 다시 만들기'}
          </button>
        )}
      </div>

      {/* 영상 프롬프트 (편집 가능) */}
      <div className="clip-detail__section">
        <div className="clip-detail__section-title">영상 프롬프트</div>
        <textarea
          className="clip-detail__prompt-area"
          value={videoPrompt}
          onChange={(e) => onVideoPromptChange(e.target.value)}
          rows={2}
          placeholder="영상 생성에 사용될 프롬프트..."
        />
        <button
          className="clip-detail__regen-btn"
          onClick={onRegenerateVideo}
          disabled={isRegenerating || !videoPrompt.trim() || isEdited}
        >
          <RefreshCw size={14} className={isRegenerating ? 'spin' : ''} />
          {isEdited ? '편집됨 — 재생성 불가' : isRegenerating ? '영상 생성 중...' : '영상 다시 만들기'}
        </button>
      </div>
    </div>
  );
};

export default ClipDetailPanel;
