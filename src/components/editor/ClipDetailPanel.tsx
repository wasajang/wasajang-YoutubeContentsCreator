/**
 * ClipDetailPanel — 타임라인 우측 클립 상세 패널
 *
 * 선택된 씬의:
 * - 사용된 설정값 (비율, 스타일, 대본, 이미지, 캐스트)
 * - 영상 프롬프트 (편집 가능)
 * - 이미지 프롬프트 (읽기 전용)
 * - "다시 만들기" 버튼
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { artStyles } from '../../data/artStyles';
import type { EditorClip } from './types';

interface ClipDetailPanelProps {
  clip: EditorClip | null;
  aspectRatio: string;
  artStyleId: string;
  videoPrompt: string;
  imagePrompt: string;
  onVideoPromptChange: (value: string) => void;
  isRegenerating: boolean;
  onRegenerateVideo: () => void;
  sceneImageUrl: string;
  castNames: string[];
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
  isRegenerating,
  onRegenerateVideo,
  sceneImageUrl,
  castNames,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

      {/* 사용된 설정값 (접이식) */}
      <div className="clip-detail__section">
        <button
          className="clip-detail__toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          {settingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>사용된 설정값</span>
        </button>
        {settingsOpen && (
          <dl className="clip-detail__settings">
            <dt>비율</dt>
            <dd>{aspectRatio}</dd>
            <dt>스타일</dt>
            <dd>{artStyle?.nameKo || artStyleId}</dd>
            <dt>대본</dt>
            <dd>{clip.text.substring(0, 50)}{clip.text.length > 50 ? '...' : ''}</dd>
            {sceneImageUrl && (
              <>
                <dt>시작이미지</dt>
                <dd><img src={sceneImageUrl} alt="시작이미지" className="clip-detail__thumb" /></dd>
              </>
            )}
            {castNames.length > 0 && (
              <>
                <dt>캐스트</dt>
                <dd>{castNames.join(', ')}</dd>
              </>
            )}
          </dl>
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
          disabled={isRegenerating || !videoPrompt.trim()}
        >
          <RefreshCw size={14} className={isRegenerating ? 'spin' : ''} />
          {isRegenerating ? '생성 중...' : '다시 만들기'}
        </button>
      </div>

      {/* 이미지 프롬프트 (읽기 전용) */}
      <div className="clip-detail__section">
        <div className="clip-detail__section-title">이미지 프롬프트</div>
        <textarea
          className="clip-detail__prompt-area clip-detail__prompt-area--readonly"
          value={imagePrompt}
          readOnly
          rows={4}
        />
      </div>
    </div>
  );
};

export default ClipDetailPanel;
