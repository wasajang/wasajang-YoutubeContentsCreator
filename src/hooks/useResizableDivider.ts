/**
 * useResizableDivider — 리사이즈 구분선 훅
 *
 * 두 영역 사이의 드래그 리사이즈를 관리합니다.
 * mainFlex: 첫 번째 영역 비율 (%), min~max 범위 제한
 *
 * 043: direction 파라미터 추가 — 'row'(상/하, 기본) 또는 'column'(좌/우)
 */
import { useState, useRef, useCallback } from 'react';

export function useResizableDivider(
  initialFlex = 42,
  min = 25,
  max = 80,
  direction: 'row' | 'column' = 'row',
) {
  const [mainFlex, setMainFlex] = useState(initialFlex);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // direction에 따라 좌표/크기 축 결정
      const startPos = direction === 'column' ? e.clientX : e.clientY;
      const containerSize = direction === 'column' ? containerRect.width : containerRect.height;
      const startFlex = mainFlex;

      const handleMove = (me: MouseEvent) => {
        const currentPos = direction === 'column' ? me.clientX : me.clientY;
        const delta = currentPos - startPos;
        const pctDelta = (delta / containerSize) * 100;
        const newFlex = Math.min(max, Math.max(min, startFlex + pctDelta));
        setMainFlex(newFlex);
      };
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [mainFlex, min, max, direction]
  );

  return { mainFlex, containerRef, handleDividerMouseDown };
}
