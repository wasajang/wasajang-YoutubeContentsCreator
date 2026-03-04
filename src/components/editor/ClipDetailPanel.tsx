/**
 * ClipDetailPanel — 타임라인 우측 클립 상세 패널
 *
 * 선택된 씬의:
 * - 설정값 그리드 (비율, 스타일, 캐스트, 시작이미지)
 * - 이미지 프롬프트 (편집 가능 + 이미지 재생성)
 * - 영상 프롬프트 (편집 가능 + 영상 재생성)
 */
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { artStyles } from '../../data/artStyles';
import type { EditorClip } from './types';

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
}) => {
  if (!clip) {
    return (
      <div className="clip-detail">
        <div className="clip-detail__placeholder">씬을 선택하세요</div>
      </div>
    );
  }

  const artStyle = artStyles.find((s) => s.id === artStyleId);

  return (
    <div className="clip-detail">
      {/* 헤더 */}
      <div className="clip-detail__header">
        <span className="clip-detail__scene-label">{clip.label}</span>
        <span className="clip-detail__time">{formatTime(clip.duration)}</span>
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
        {sceneImageUrl && (
          <div className="clip-detail__setting-card">
            <span className="clip-detail__setting-label">시작 이미지</span>
            <div className="clip-detail__setting-thumb">
              <img src={sceneImageUrl} alt="시드 이미지" />
            </div>
          </div>
        )}
        {castNames.length > 0 && (
          <div className="clip-detail__setting-card">
            <span className="clip-detail__setting-label">캐스트</span>
            <div className="clip-detail__setting-tags">
              {castNames.map((name) => (
                <span key={name} className="clip-detail__tag">{name}</span>
              ))}
            </div>
          </div>
        )}
        <div className="clip-detail__setting-card clip-detail__setting-card--full">
          <span className="clip-detail__setting-label">대본</span>
          <span className="clip-detail__setting-value clip-detail__setting-value--text">
            {clip.text.substring(0, 80)}{clip.text.length > 80 ? '...' : ''}
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
          rows={4}
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
          rows={5}
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
