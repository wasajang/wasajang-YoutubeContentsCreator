// VrewClipTokens — 단어 토큰 칩 렌더링 + 칩 사이 분할 커서 + 인라인 액션 바
import React, { useState, useEffect } from 'react';
import { Scissors } from 'lucide-react';
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

  // Enter/Escape 키 이벤트 처리 — 리스너를 항상 등록하고 내부에서 조건 체크
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (selectedSplitIndex === null) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onSplitAfterWord(selectedSplitIndex);
        setSelectedSplitIndex(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedSplitIndex(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedSplitIndex, onSplitAfterWord]);

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
        const showSplitGap = idx < words.length - 1;
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

            {/* 단어 사이 gap (독립 클릭 영역, 12px 폭) */}
            {showSplitGap && (
              <span
                className={`vrew-token__gap${isSplitSelected ? ' vrew-token__gap--selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${idx + 1}번째 단어 뒤에서 분할`}
                title="클릭하여 분할 위치 선택"
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
                <span className="vrew-token__gap-line" />
              </span>
            )}
          </React.Fragment>
        );
      })}

      {/* 분할 포인트 선택 시 인라인 액션 바 */}
      {selectedSplitIndex !== null && (
        <div className="vrew-tokens__action-bar">
          <button
            className="vrew-tokens__action-btn"
            onClick={() => {
              onSplitAfterWord(selectedSplitIndex!);
              setSelectedSplitIndex(null);
            }}
          >
            <Scissors size={12} /> 여기서 나누기
          </button>
          <span className="vrew-tokens__hint-text">Enter: 나누기 / Esc: 취소</span>
        </div>
      )}
    </div>
  );
};

export default VrewClipTokens;
