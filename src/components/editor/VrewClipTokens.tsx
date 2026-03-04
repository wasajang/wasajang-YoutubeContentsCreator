// VrewClipTokens — 단어 토큰 칩 렌더링 + Enter 키 클립 분할 핵심 컴포넌트
import React, { useState, useEffect, useCallback } from 'react';
import type { WordTiming } from '../../store/projectStore';

interface VrewClipTokensProps {
  words: WordTiming[];
  currentTime: number;
  clipAudioStart: number;
  clipAudioEnd: number;
  onSplitAfterWord: (globalWordIndex: number) => void;
}

const VrewClipTokens: React.FC<VrewClipTokensProps> = ({
  words,
  currentTime,
  clipAudioStart,
  clipAudioEnd,
  onSplitAfterWord,
}) => {
  const [selectedSplitIndex, setSelectedSplitIndex] = useState<number | null>(null);

  // 현재 재생 중인 단어 인덱스 계산
  const activeWordIndex = words.findIndex(
    (w) =>
      currentTime >= w.startTime && currentTime < w.endTime
  );

  // Enter/Escape 키 이벤트 처리
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedSplitIndex === null) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onSplitAfterWord(selectedSplitIndex);
        setSelectedSplitIndex(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedSplitIndex(null);
      }
    },
    [selectedSplitIndex, onSplitAfterWord]
  );

  useEffect(() => {
    if (selectedSplitIndex === null) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSplitIndex, handleKeyDown]);

  // 클립 범위 밖이면 빈 상태
  if (words.length === 0) {
    return (
      <div className="vrew-tokens vrew-tokens--empty">
        <span className="vrew-tokens__placeholder">단어 타이밍 없음</span>
      </div>
    );
  }

  return (
    <div
      className="vrew-tokens"
      role="group"
      aria-label="단어 토큰 — 사이를 클릭 후 Enter로 분할"
      // 외부 클릭 시 분할 커서 해제
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).classList.contains('vrew-tokens')) {
          setSelectedSplitIndex(null);
        }
      }}
    >
      {words.map((word, idx) => {
        const isActive =
          activeWordIndex === idx ||
          (activeWordIndex === -1 &&
            currentTime >= clipAudioStart &&
            currentTime < clipAudioEnd &&
            idx === 0);

        // 단어 사이 분할 포인트 (마지막 단어 뒤 제외)
        const showSplitPoint = idx < words.length - 1;
        const isSplitSelected = selectedSplitIndex === idx;

        return (
          <React.Fragment key={`${word.text}-${idx}`}>
            {/* 단어 토큰 */}
            <span
              className={[
                'vrew-token',
                isActive ? 'vrew-token--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={`${word.startTime.toFixed(2)}s — ${word.endTime.toFixed(2)}s`}
            >
              {word.text}
            </span>

            {/* 단어 사이 분할 포인트 */}
            {showSplitPoint && (
              <span
                className={[
                  'vrew-token__split-point',
                  isSplitSelected ? 'vrew-token__split-point--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                aria-label={`${idx + 1}번째 단어 뒤에서 분할`}
                title="클릭 후 Enter로 분할"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSplitIndex(isSplitSelected ? null : idx);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedSplitIndex(isSplitSelected ? null : idx);
                  }
                }}
              >
                {isSplitSelected ? (
                  <span className="vrew-token__split-cursor" aria-hidden="true">|</span>
                ) : (
                  <span className="vrew-token__split-dot" aria-hidden="true" />
                )}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {/* 선택된 분할 포인트 안내 */}
      {selectedSplitIndex !== null && (
        <span className="vrew-tokens__hint" role="status" aria-live="polite">
          Enter: 분할 / Esc: 취소
        </span>
      )}
    </div>
  );
};

export default VrewClipTokens;
