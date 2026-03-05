/**
 * TtsPopupModal — TTS 음성 생성 팝업 모달 (시네마틱 모드)
 *
 * VrewEditor에서 분리된 TTS 팝업 UI 컴포넌트.
 * ttsPopup, ttsText, isTtsGenerating 상태를 props로 받습니다.
 */
import React, { useEffect } from 'react';

interface TtsPopupModalProps {
  ttsPopup: { startTime: number } | null;
  ttsText: string;
  isTtsGenerating: boolean;
  onClose: () => void;
  onTextChange: (text: string) => void;
  onGenerate: () => void;
}

const TtsPopupModal: React.FC<TtsPopupModalProps> = ({
  ttsPopup,
  ttsText,
  isTtsGenerating,
  onClose,
  onTextChange,
  onGenerate,
}) => {
  // ESC로 팝업 닫기
  useEffect(() => {
    if (!ttsPopup) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ttsPopup, onClose]);

  if (!ttsPopup) return null;

  const m = Math.floor(ttsPopup.startTime / 60);
  const s = Math.floor(ttsPopup.startTime % 60);
  const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div className="tts-popup-overlay" onClick={onClose}>
      <div className="tts-popup" onClick={(e) => e.stopPropagation()}>
        <div className="tts-popup__header">
          <h3>음성 생성 (TTS)</h3>
          <span className="tts-popup__time">시작: {timeStr}</span>
        </div>
        <textarea
          className="tts-popup__textarea"
          value={ttsText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="음성으로 변환할 텍스트를 입력하세요..."
          rows={3}
          autoFocus
        />
        <div className="tts-popup__actions">
          <button className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary"
            onClick={onGenerate}
            disabled={isTtsGenerating || !ttsText.trim()}
          >
            {isTtsGenerating ? '생성 중...' : '음성 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TtsPopupModal;
