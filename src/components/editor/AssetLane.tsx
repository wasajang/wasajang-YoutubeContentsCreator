/**
 * AssetLane.tsx — 나레이션 편집기 에셋 레인
 * 클립 리스트 왼쪽에 표시되는 이미지/영상 적용 범위 표시 레인.
 * 드래그로 적용 범위(startClipIndex / endClipIndex) 조절 가능.
 */
import React, { useCallback, useRef } from 'react';
import { Image, Video } from 'lucide-react';
import type { MediaRange } from './types';

interface AssetLaneProps {
  mediaRanges: MediaRange[];
  clipCount: number;
  clipOffsets: number[];      // 각 클립의 Y 오프셋 (px, 스크롤 컨테이너 기준)
  clipHeights: number[];      // 각 클립의 높이 (px)
  onRangeResize: (rangeId: string, newStartIndex: number, newEndIndex: number) => void;
  onRangeClick: (rangeId: string, event: React.MouseEvent) => void;
}

/** 드래그 중 상태 */
interface DragState {
  rangeId: string;
  handle: 'top' | 'bottom';
  currentStart: number;
  currentEnd: number;
}

/**
 * Y 좌표를 가장 가까운 클립 경계 인덱스로 스냅.
 * - handle === 'top'  : startClipIndex (0 ~ currentEnd)
 * - handle === 'bottom': endClipIndex  (currentStart ~ clipCount-1)
 */
function snapToClipIndex(
  y: number,
  clipOffsets: number[],
  clipHeights: number[],
  handle: 'top' | 'bottom',
  currentStart: number,
  currentEnd: number,
  clipCount: number,
): number {
  if (clipOffsets.length === 0) return 0;

  let closest = handle === 'top' ? currentStart : currentEnd;
  let minDist = Infinity;

  for (let i = 0; i < clipCount; i++) {
    const midY = clipOffsets[i] + (clipHeights[i] ?? 0) / 2;
    const dist = Math.abs(y - midY);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }

  // 최소 범위 1 클립 보장
  if (handle === 'top') return Math.min(closest, currentEnd);
  return Math.max(closest, currentStart);
}

const AssetLane: React.FC<AssetLaneProps> = ({
  mediaRanges,
  clipCount,
  clipOffsets,
  clipHeights,
  onRangeResize,
  onRangeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  // 드래그 중 라이브 미리보기를 위한 로컬 override 상태
  const [liveOverride, setLiveOverride] = React.useState<{
    rangeId: string;
    startClipIndex: number;
    endClipIndex: number;
  } | null>(null);

  // 최신 props를 항상 참조하기 위한 refs
  const clipOffsetsRef = useRef(clipOffsets);
  clipOffsetsRef.current = clipOffsets;
  const clipHeightsRef = useRef(clipHeights);
  clipHeightsRef.current = clipHeights;
  const clipCountRef = useRef(clipCount);
  clipCountRef.current = clipCount;
  const onRangeResizeRef = useRef(onRangeResize);
  onRangeResizeRef.current = onRangeResize;

  const getContainerScrollY = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return rect.top;
  }, []);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      range: MediaRange,
      handle: 'top' | 'bottom',
    ) => {
      e.stopPropagation();
      e.preventDefault();

      dragStateRef.current = {
        rangeId: range.id,
        handle,
        currentStart: range.startClipIndex,
        currentEnd: range.endClipIndex,
      };

      const handleMouseMove = (me: MouseEvent) => {
        const ds = dragStateRef.current;
        if (!ds || clipOffsetsRef.current.length === 0) return;

        const containerTop = getContainerScrollY();
        const relY = me.clientY - containerTop;

        const newIndex = snapToClipIndex(
          relY,
          clipOffsetsRef.current,
          clipHeightsRef.current,
          ds.handle,
          ds.currentStart,
          ds.currentEnd,
          clipCountRef.current,
        );

        const newStart = ds.handle === 'top' ? newIndex : ds.currentStart;
        const newEnd = ds.handle === 'bottom' ? newIndex : ds.currentEnd;

        dragStateRef.current = { ...ds, currentStart: newStart, currentEnd: newEnd };
        setLiveOverride({ rangeId: ds.rangeId, startClipIndex: newStart, endClipIndex: newEnd });
      };

      const handleMouseUp = () => {
        const ds = dragStateRef.current;
        if (ds) {
          onRangeResizeRef.current(ds.rangeId, ds.currentStart, ds.currentEnd);
        }
        dragStateRef.current = null;
        setLiveOverride(null);

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [getContainerScrollY],
  );

  // clipOffsets / clipHeights 가드
  const isReady =
    clipOffsets.length > 0 &&
    clipHeights.length > 0 &&
    clipOffsets.length === clipHeights.length;

  return (
    <div className="asset-lane" ref={containerRef}>
      {isReady &&
        mediaRanges.map((range) => {
          // 라이브 드래그 오버라이드 적용
          const startIdx =
            liveOverride?.rangeId === range.id
              ? liveOverride.startClipIndex
              : range.startClipIndex;
          const endIdx =
            liveOverride?.rangeId === range.id
              ? liveOverride.endClipIndex
              : range.endClipIndex;

          // 인덱스 범위 보호
          if (
            startIdx < 0 ||
            endIdx >= clipOffsets.length ||
            startIdx > endIdx
          ) {
            return null;
          }

          const top = clipOffsets[startIdx];
          const height =
            clipOffsets[endIdx] + clipHeights[endIdx] - clipOffsets[startIdx];

          // 아이콘 높이(32) + 상단 핸들(5) 고려한 라인 높이
          const iconH = 32;
          const lineHeight = Math.max(0, height - iconH);

          return (
            <div
              key={range.id}
              className="asset-lane__range"
              style={{ top, height }}
            >
              {/* 위 드래그 핸들 */}
              <div
                className="asset-lane__handle asset-lane__handle--top"
                onMouseDown={(e) => startDrag(e, range, 'top')}
              />

              {/* 에셋 아이콘 (썸네일 or 비디오 아이콘) */}
              <div
                className="asset-lane__icon"
                onClick={(e) => onRangeClick(range.id, e)}
                title={range.type === 'image' ? '이미지 에셋' : '비디오 에셋'}
              >
                {range.url ? (
                  <img
                    src={range.url}
                    alt={range.type}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : range.type === 'video' ? (
                  <Video size={16} color="var(--accent-primary)" />
                ) : (
                  <Image size={16} color="var(--text-secondary)" />
                )}
                {/* 비디오 타입이고 url 있으면 비디오 오버레이 아이콘 */}
                {range.type === 'video' && range.url && (
                  <div className="asset-lane__icon-overlay">
                    <Video size={10} color="#fff" />
                  </div>
                )}
              </div>

              {/* 적용 범위 세로선 */}
              {lineHeight > 0 && (
                <div
                  className="asset-lane__line"
                  style={{ height: lineHeight }}
                />
              )}

              {/* 아래 드래그 핸들 */}
              <div
                className="asset-lane__handle asset-lane__handle--bottom"
                onMouseDown={(e) => startDrag(e, range, 'bottom')}
              />
            </div>
          );
        })}
    </div>
  );
};

export default AssetLane;
