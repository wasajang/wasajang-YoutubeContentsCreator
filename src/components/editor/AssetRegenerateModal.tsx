/**
 * AssetRegenerateModal — 에셋 교체(재생성) 팝업 모달
 *
 * 에셋 메뉴 "교체 (재생성)" 클릭 시 열림.
 * 이미지 프롬프트 편집 + 씨드카드 선택 + 영상화 옵션 + 대본 참조.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X } from 'lucide-react';
import type { MediaRange, EditorClip } from './types';
import type { AssetCard } from '../../store/projectStore';
import { buildImagePrompt, buildVideoPrompt } from '../../services/prompt-builder';

interface AssetRegenerateModalProps {
  range: MediaRange | null;
  rangeClips: EditorClip[];
  initialImagePrompt: string;
  initialVideoPrompt: string;
  onClose: () => void;
  onRegenerateImage: (prompt: string) => Promise<void>;
  onRegenerateVideo: (prompt: string) => Promise<void>;
  isRegenerating: boolean;
  /** 마이 덱에서 사용 가능한 카드 목록 */
  availableCards?: AssetCard[];
  /** 이 씬에 기본 배정된 씨드 카드 ID 목록 */
  initialSeedIds?: string[];
  artStyleId?: string;
  templateId?: string;
}

const AssetRegenerateModal: React.FC<AssetRegenerateModalProps> = ({
  range,
  rangeClips,
  initialImagePrompt,
  initialVideoPrompt,
  onClose,
  onRegenerateImage,
  onRegenerateVideo,
  isRegenerating,
  availableCards,
  initialSeedIds,
  artStyleId,
  templateId,
}) => {
  const [imagePrompt, setImagePrompt] = useState(initialImagePrompt);
  const [videoPrompt, setVideoPrompt] = useState(initialVideoPrompt);
  const [alsoVideo, setAlsoVideo] = useState(range?.type === 'video');
  const [step, setStep] = useState<'idle' | 'image' | 'video' | 'done'>('idle');
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>(initialSeedIds || []);
  const [promptManuallyEdited, setPromptManuallyEdited] = useState(false);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    setImagePrompt(initialImagePrompt);
    setVideoPrompt(initialVideoPrompt);
    setStep('idle');
    setAlsoVideo(range?.type === 'video');
    setSelectedSeedIds(initialSeedIds || []);
    setPromptManuallyEdited(false);
  }, [range?.id, initialImagePrompt, initialVideoPrompt, range?.type, initialSeedIds]);

  // ESC 닫기
  useEffect(() => {
    if (!range) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRegenerating) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [range, onClose, isRegenerating]);

  // 선택된 카드 객체 목록
  const selectedCards = useMemo(() => {
    if (!availableCards || availableCards.length === 0) return [];
    return selectedSeedIds
      .map((id) => availableCards.find((c) => c.id === id))
      .filter(Boolean) as AssetCard[];
  }, [availableCards, selectedSeedIds]);

  // 씨드카드 선택 변경 → 프롬프트 자동 재빌드 (수동 편집하지 않은 경우에만)
  useEffect(() => {
    if (promptManuallyEdited || !range) return;
    const sceneText = rangeClips.map((c) => c.text).join(' ');
    const newImagePrompt = buildImagePrompt({
      artStyleId: artStyleId ?? 'cinematic',
      sceneText,
      seedCards: selectedCards,
      templateId: templateId ?? undefined,
    });
    const newVideoPrompt = buildVideoPrompt({
      artStyleId: artStyleId ?? 'cinematic',
      sceneText,
      seedCards: selectedCards,
      templateId: templateId ?? undefined,
    });
    setImagePrompt(newImagePrompt);
    setVideoPrompt(newVideoPrompt);
  }, [selectedCards.length, rangeClips, artStyleId, templateId]); // eslint-disable-line

  // 씨드 토글
  const handleToggleSeed = (cardId: string) => {
    setSelectedSeedIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
    setPromptManuallyEdited(false); // 씨드 변경 시 자동 재빌드 활성화
  };

  if (!range) return null;

  const scriptText = rangeClips.map((c) => c.text).join(' ');
  const hasCards = availableCards && availableCards.length > 0;

  const handleRegenerate = async () => {
    setStep('image');
    await onRegenerateImage(imagePrompt);
    if (alsoVideo) {
      setStep('video');
      await onRegenerateVideo(videoPrompt);
    }
    setStep('done');
    setTimeout(() => onClose(), 600);
  };

  return (
    <div className="asset-regen-overlay" onClick={!isRegenerating ? onClose : undefined}>
      <div className="asset-regen-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="asset-regen-modal__header">
          <h3>에셋 교체 (재생성)</h3>
          <div className="asset-regen-modal__header-right">
            <span className="asset-regen-modal__range-info">
              클립 {range.startClipIndex + 1}~{range.endClipIndex + 1}
            </span>
            <button
              className="asset-regen-modal__close"
              onClick={onClose}
              disabled={isRegenerating}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 현재 에셋 썸네일 */}
        {range.url && (
          <div className="asset-regen-modal__thumb">
            <img src={range.url} alt="현재 에셋" />
          </div>
        )}

        {/* 대본 참조 (읽기 전용) */}
        <div className="asset-regen-modal__script-ref">
          <span className="asset-regen-modal__label">대본 참조</span>
          <p className="asset-regen-modal__script-text">
            {scriptText.length > 200 ? scriptText.slice(0, 200) + '...' : scriptText}
          </p>
        </div>

        {/* 씨드카드 피커 (마이 덱에서 선택) */}
        {hasCards && (
          <div className="asset-regen-modal__section">
            <span className="asset-regen-modal__label">
              캐스트 카드 ({selectedSeedIds.length}/{availableCards!.length})
            </span>
            <div className="asset-regen-modal__card-picker">
              {availableCards!.map((card) => {
                const isSelected = selectedSeedIds.includes(card.id);
                return (
                  <button
                    key={card.id}
                    className={[
                      'asset-regen-modal__seed-chip',
                      isSelected ? 'asset-regen-modal__seed-chip--selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleToggleSeed(card.id)}
                    disabled={isRegenerating}
                    title={card.description || card.name}
                  >
                    {card.imageUrl && (
                      <img
                        className="asset-regen-modal__seed-chip-img"
                        src={card.imageUrl}
                        alt={card.name}
                      />
                    )}
                    <span>{card.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 이미지 프롬프트 */}
        <div className="asset-regen-modal__section">
          <span className="asset-regen-modal__label">이미지 프롬프트</span>
          <textarea
            className="asset-regen-modal__textarea"
            value={imagePrompt}
            onChange={(e) => {
              setImagePrompt(e.target.value);
              setPromptManuallyEdited(true);
            }}
            rows={3}
            disabled={isRegenerating}
          />
        </div>

        {/* 영상화 토글 */}
        <label className="asset-regen-modal__video-toggle">
          <input
            type="checkbox"
            checked={alsoVideo}
            onChange={(e) => setAlsoVideo(e.target.checked)}
            disabled={isRegenerating}
          />
          <span>영상화도 함께</span>
        </label>

        {/* 영상 프롬프트 */}
        {alsoVideo && (
          <div className="asset-regen-modal__section">
            <span className="asset-regen-modal__label">영상 프롬프트</span>
            <textarea
              className="asset-regen-modal__textarea"
              value={videoPrompt}
              onChange={(e) => {
                setVideoPrompt(e.target.value);
                setPromptManuallyEdited(true);
              }}
              rows={2}
              disabled={isRegenerating}
            />
          </div>
        )}

        {/* 액션 */}
        <div className="asset-regen-modal__actions">
          <button className="btn-secondary" onClick={onClose} disabled={isRegenerating}>
            취소
          </button>
          <button
            className="asset-regen-modal__btn-regen"
            onClick={handleRegenerate}
            disabled={isRegenerating || !imagePrompt.trim()}
          >
            <RefreshCw size={14} className={isRegenerating ? 'spin' : ''} />
            {step === 'idle' ? '재생성' :
             step === 'image' ? '이미지 생성 중...' :
             step === 'video' ? '영상 생성 중...' : '완료!'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetRegenerateModal;
