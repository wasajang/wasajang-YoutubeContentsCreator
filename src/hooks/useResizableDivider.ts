/**
 * useResizableDivider — 수직 리사이즈 구분선 훅
 *
 * 상단 영역과 하단 영역 사이의 드래그 리사이즈를 관리합니다.
 * mainFlex: 상단 영역 비율 (%), min~max 범위 제한
 */
import { useState, useRef, useCallback } from 'react';

export function useResizableDivider(initialFlex = 42, min = 25, max = 80) {
  const [mainFlex, setMainFlex] = useState(initialFlex);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const startY = e.clientY;
      const startFlex = mainFlex;
      const containerH = container.getBoundingClientRect().height;

      const handleMove = (me: MouseEvent) => {
        const dy = me.clientY - startY;
        const pctDelta = (dy / containerH) * 100;
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
    [mainFlex, min, max]
  );

  return { mainFlex, containerRef, handleDividerMouseDown };
}
