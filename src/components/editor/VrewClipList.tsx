// VrewClipList — 클립 카드 리스트 + 인라인 에셋 인디케이터 + 씬 헤더
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Image, Video, ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import type { EditorClip, MediaRange } from './types';
import VrewClipCard from './VrewClipCard';
import ClipContextMenu from './ClipContextMenu';

interface VrewClipListProps {
  clips: EditorClip[];
  currentClipIndex: number;
  currentTime: number;
  onClipSelect: (index: number) => void;
  onSplitAtWord: (clipIndex: number, globalWordIndex: number) => void;
  onMergeWithPrev: (clipIndex: number) => void;
  onDelete: (clipIndex: number) => void;
  onGenerateImage: (clipId: string) => void;
  onGenerateVideo: (clipId: string) => void;
  onGenerateSceneImage: (sceneId: string) => void;
  onGenerateSceneVideo: (sceneId: string) => void;
  onGenerateAllImages: () => void;
  onGenerateAllVideos: () => void;
  clipGenStatus: Record<string, string>;
  clipVideoGenStatus: Record<string, string>;
  mediaRanges?: MediaRange[];
  onMediaRangeResize?: (rangeId: string, newStart: number, newEnd: number) => void;
  onMediaRangeClick?: (rangeId: string, event: React.MouseEvent) => void;
  onMediaRangeDelete?: (rangeId: string) => void;
}

const VrewClipList: React.FC<VrewClipListProps> = ({
  clips,
  currentClipIndex,
  currentTime,
  onClipSelect,
  onSplitAtWord,
  onMergeWithPrev,
  onDelete,
  onGenerateImage,
  onGenerateVideo,
  onGenerateAllImages,
  onGenerateAllVideos,
  clipGenStatus,
  clipVideoGenStatus,
  mediaRanges,
  onMediaRangeResize,
  onMediaRangeClick,
  onMediaRangeDelete,
}) => {
  // 클립 카드 컨테이너 ref (자동 스크롤용 + 에셋 드래그 위치 계산)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 선택된 클립 자동 스크롤
  useEffect(() => {
    const el = cardRefs.current[currentClipIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentClipIndex]);

  // 씬 그룹 계산 (sceneId 기준)
  const sceneGroups = useMemo(() => {
    const groups: { sceneId: string; startIndex: number; endIndex: number; text: string; startTime: number; totalDuration: number }[] = [];
    let i = 0;
    while (i < clips.length) {
      const sceneId = clips[i].sceneId;
      const start = i;
      let duration = 0;
      while (i < clips.length && clips[i].sceneId === sceneId) {
        duration += clips[i].duration;
        i++;
      }
      groups.push({
        sceneId,
        startIndex: start,
        endIndex: i - 1,
        text: clips[start].text,
        startTime: clips[start].audioStartTime,
        totalDuration: duration,
      });
    }
    return groups;
  }, [clips]);

  // 씬 접기 상태
  const [collapsedScenes, setCollapsedScenes] = useState<Set<string>>(new Set());
  const toggleSceneCollapse = useCallback((sceneId: string) => {
    setCollapsedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }, []);

  // 에셋 호버/클릭 상태
  const [hoveredRangeId, setHoveredRangeId] = useState<string | null>(null);
  const [assetMenu, setAssetMenu] = useState<{
    rangeId: string;
    x: number;
    y: number;
  } | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipIndex: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, clipIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, clipIndex });
  }, []);

  // 에셋 아이콘 클릭 → 메뉴
  const handleAssetIconClick = useCallback((e: React.MouseEvent, rangeId: string) => {
    e.stopPropagation();
    setAssetMenu({ rangeId, x: e.clientX, y: e.clientY });
  }, []);

  // 에셋 적용범위 드래그 확장/축소
  const [dragLiveRange, setDragLiveRange] = useState<{
    rangeId: string;
    startClipIndex: number;
    endClipIndex: number;
  } | null>(null);

  const onMediaRangeResizeRef = useRef(onMediaRangeResize);
  onMediaRangeResizeRef.current = onMediaRangeResize;

  const startAssetResize = useCallback((
    e: React.MouseEvent,
    rangeId: string,
    handle: 'top' | 'bottom',
    currentStart: number,
    currentEnd: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const state = { rangeId, handle, currentStart, currentEnd };

    const findClosestClipIndex = (clientY: number): number => {
      let closest = handle === 'top' ? currentStart : currentEnd;
      let minDist = Infinity;
      cardRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(clientY - midY);
        if (dist < minDist) {
          minDist = dist;
          closest = idx;
        }
      });
      // 범위 제한
      if (handle === 'top') return Math.min(closest, state.currentEnd);
      return Math.max(closest, state.currentStart);
    };

    const handleMove = (me: MouseEvent) => {
      const newIdx = findClosestClipIndex(me.clientY);
      const newStart = state.handle === 'top' ? newIdx : state.currentStart;
      const newEnd = state.handle === 'bottom' ? newIdx : state.currentEnd;
      state.currentStart = newStart;
      state.currentEnd = newEnd;
      setDragLiveRange({ rangeId: state.rangeId, startClipIndex: newStart, endClipIndex: newEnd });
    };

    const handleUp = () => {
      onMediaRangeResizeRef.current?.(state.rangeId, state.currentStart, state.currentEnd);
      setDragLiveRange(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  // 클립 인덱스로 MediaRange 조회 (드래그 라이브 범위 반영)
  const getRangeForClip = useCallback((clipIndex: number): (MediaRange & { _liveStart?: number; _liveEnd?: number }) | undefined => {
    if (!mediaRanges) return undefined;
    for (const r of mediaRanges) {
      const start = dragLiveRange?.rangeId === r.id ? dragLiveRange.startClipIndex : r.startClipIndex;
      const end = dragLiveRange?.rangeId === r.id ? dragLiveRange.endClipIndex : r.endClipIndex;
      if (clipIndex >= start && clipIndex <= end) {
        return { ...r, startClipIndex: start, endClipIndex: end, _liveStart: start, _liveEnd: end };
      }
    }
    return undefined;
  }, [mediaRanges, dragLiveRange]);

  // 일괄 버튼 레이블 계산
  const missingImageCount = clips.filter((c) => !c.imageUrl).length;
  const missingVideoCount = clips.filter(
    (c) => c.imageUrl && !c.isVideoEnabled
  ).length;

  const isAnyImageGenerating = clips.some(
    (c) => clipGenStatus[c.id] === 'generating'
  );
  const isAnyVideoGenerating = clips.some(
    (c) => clipVideoGenStatus[c.id] === 'generating'
  );

  // MediaRange 기반 이미지 URL 헬퍼
  const getAppliedImage = (clipIndex: number): string => {
    if (!mediaRanges) return clips[clipIndex]?.imageUrl || '';
    const range = mediaRanges.find(
      (r) =>
        r.type === 'image' &&
        clipIndex >= r.startClipIndex &&
        clipIndex <= r.endClipIndex
    );
    return range?.url || clips[clipIndex]?.imageUrl || '';
  };

  if (clips.length === 0) {
    return (
      <div className="vrew-clip-list vrew-clip-list--empty">
        <p className="vrew-clip-list__empty-msg">클립이 없습니다.</p>
      </div>
    );
  }

  const hasMediaRanges = mediaRanges && mediaRanges.length > 0;

  return (
    <div className="vrew-clip-list">
      {/* 헤더 */}
      <div className="vrew-clip-list__header">
        <span className="vrew-clip-list__title">Vrew Editor</span>
        <span className="vrew-clip-list__count">클립 {clips.length}개</span>
      </div>

      {/* 일괄 생성 버튼 */}
      <div className="vrew-clip-list__bulk-actions">
        <button
          className={[
            'vrew-clip-list__bulk-btn',
            isAnyImageGenerating ? 'vrew-clip-list__bulk-btn--loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateAllImages}
          disabled={isAnyImageGenerating || missingImageCount === 0}
          title={
            missingImageCount === 0
              ? '모든 클립에 이미지가 있습니다'
              : `이미지 없는 클립 ${missingImageCount}개 일괄 생성`
          }
        >
          <Image size={14} />
          {isAnyImageGenerating
            ? '생성 중...'
            : missingImageCount > 0
            ? `이미지 ${missingImageCount}개 생성`
            : '이미지 완료'}
        </button>

        <button
          className={[
            'vrew-clip-list__bulk-btn',
            isAnyVideoGenerating ? 'vrew-clip-list__bulk-btn--loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onGenerateAllVideos}
          disabled={isAnyVideoGenerating || missingVideoCount === 0}
          title={
            missingVideoCount === 0
              ? '모든 클립에 영상이 있거나 이미지가 없습니다'
              : `영상 없는 클립 ${missingVideoCount}개 일괄 생성`
          }
        >
          <Video size={14} />
          {isAnyVideoGenerating
            ? '생성 중...'
            : missingVideoCount > 0
            ? `영상 ${missingVideoCount}개 생성`
            : '영상 완료'}
        </button>
      </div>

      {/* 클립 카드 리스트 (인라인 에셋 인디케이터 포함) */}
      <div className="vrew-clip-list__cards">
        {clips.map((clip, i) => {
          // 씬 그룹 정보
          const group = sceneGroups.find(g => g.sceneId === clip.sceneId);
          const isFirstOfScene = group?.startIndex === i;
          const isCollapsed = collapsedScenes.has(clip.sceneId);
          const sceneIdx = group ? sceneGroups.indexOf(group) + 1 : i + 1;

          // 접힌 씬의 첫 번째가 아닌 클립은 숨김
          if (!isFirstOfScene && isCollapsed) return null;

          // 에셋 범위 정보
          const range = getRangeForClip(i);
          const isRangeStart = range && i === range.startClipIndex;
          const isRangeEnd = range && i === range.endClipIndex;
          const isInRange = !!range;
          const isRangeHighlighted = range && (
            hoveredRangeId === range.id ||
            assetMenu?.rangeId === range.id
          );

          const formatSceneTime = (sec: number) => {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          };

          return (
            <React.Fragment key={clip.id}>
              {/* 씬 구분 헤더 */}
              {isFirstOfScene && sceneGroups.length > 1 && (
                <div
                  className="vrew-clip-list__scene-header"
                  onClick={() => toggleSceneCollapse(clip.sceneId)}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="vrew-clip-list__scene-num">#{sceneIdx}</span>
                  <span className="vrew-clip-list__scene-text">
                    {(group?.text || '').length > 30
                      ? (group?.text || '').slice(0, 30) + '\u2026'
                      : group?.text}
                  </span>
                  <span className="vrew-clip-list__scene-time">
                    {formatSceneTime(group?.startTime || 0)} + {(group?.totalDuration || 0).toFixed(1)}초
                  </span>
                </div>
              )}

              {/* 클립 카드 행 (에셋 인디케이터 + 카드) */}
              {!isCollapsed && (
                <div
                  className={[
                    'vrew-clip-list__card-row',
                    isRangeHighlighted ? 'vrew-clip-list__card-row--highlighted' : '',
                  ].filter(Boolean).join(' ')}
                  ref={(el) => { cardRefs.current[i] = el; }}
                >
                  {/* 에셋 인디케이터 (왼쪽 칼럼) */}
                  {hasMediaRanges && (
                    <div className={[
                      'vrew-clip-list__asset-col',
                      isInRange ? 'vrew-clip-list__asset-col--in-range' : '',
                      isRangeStart ? 'vrew-clip-list__asset-col--start' : '',
                      isRangeEnd ? 'vrew-clip-list__asset-col--end' : '',
                    ].filter(Boolean).join(' ')}>
                      {/* 위쪽 드래그 핸들 (범위 시작) */}
                      {isRangeStart && range && onMediaRangeResize && (
                        <div
                          className="vrew-clip-list__asset-handle vrew-clip-list__asset-handle--top"
                          onMouseDown={(e) => startAssetResize(e, range.id, 'top', range.startClipIndex, range.endClipIndex)}
                          title="위로 드래그하여 범위 확장"
                        />
                      )}
                      {/* 적용 범위 세로선 */}
                      {isInRange && (
                        <div className="vrew-clip-list__asset-line" />
                      )}
                      {/* 첫 클립에 에셋 아이콘 */}
                      {isRangeStart && range && (
                        <div
                          className="vrew-clip-list__asset-icon"
                          onClick={(e) => handleAssetIconClick(e, range.id)}
                          onMouseEnter={() => setHoveredRangeId(range.id)}
                          onMouseLeave={() => setHoveredRangeId(null)}
                          title={range.type === 'image' ? '이미지 에셋' : '비디오 에셋'}
                        >
                          {range.url ? (
                            <img
                              src={range.url}
                              alt={range.type}
                              className="vrew-clip-list__asset-thumb"
                            />
                          ) : range.type === 'video' ? (
                            <Video size={14} color="var(--accent-primary)" />
                          ) : (
                            <Image size={14} color="var(--text-secondary)" />
                          )}
                          {range.type === 'video' && range.url && (
                            <span className="vrew-clip-list__asset-badge">
                              <Video size={8} color="#fff" />
                            </span>
                          )}
                        </div>
                      )}
                      {/* 아래쪽 드래그 핸들 (범위 끝) */}
                      {isRangeEnd && range && onMediaRangeResize && (
                        <div
                          className="vrew-clip-list__asset-handle vrew-clip-list__asset-handle--bottom"
                          onMouseDown={(e) => startAssetResize(e, range.id, 'bottom', range.startClipIndex, range.endClipIndex)}
                          title="아래로 드래그하여 범위 확장"
                        />
                      )}
                    </div>
                  )}

                  {/* 클립 카드 */}
                  <div className="vrew-clip-list__card-wrap">
                    <VrewClipCard
                      clip={clip}
                      index={i}
                      isActive={currentClipIndex === i}
                      currentTime={currentTime}
                      onSelect={() => onClipSelect(i)}
                      onSplitAtWord={(gwi) => onSplitAtWord(i, gwi)}
                      onMergeWithPrev={() => onMergeWithPrev(i)}
                      onDelete={() => onDelete(i)}
                      onGenerateImage={() => onGenerateImage(clip.id)}
                      onGenerateVideo={() => onGenerateVideo(clip.id)}
                      isGeneratingImage={clipGenStatus[clip.id] === 'generating'}
                      isGeneratingVideo={clipVideoGenStatus[clip.id] === 'generating'}
                      appliedImageUrl={getAppliedImage(i)}
                      onContextMenu={(e) => handleContextMenu(e, i)}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 에셋 메뉴 팝업 */}
      {assetMenu && (() => {
        const range = mediaRanges?.find(r => r.id === assetMenu.rangeId);
        if (!range) return null;
        return (
          <>
            <div
              className="clip-context-menu__overlay"
              onClick={() => setAssetMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setAssetMenu(null); }}
            />
            <div
              className="clip-context-menu"
              style={{ top: assetMenu.y, left: assetMenu.x }}
              role="menu"
            >
              <button
                className="clip-context-menu__item"
                role="menuitem"
                onClick={() => {
                  if (range.sceneId) {
                    onMediaRangeClick?.(range.id, {} as React.MouseEvent);
                  }
                  setAssetMenu(null);
                }}
              >
                <RefreshCw size={13} />
                교체 (재생성)
              </button>
              {onMediaRangeDelete && (
                <button
                  className="clip-context-menu__item clip-context-menu__item--danger"
                  role="menuitem"
                  onClick={() => {
                    onMediaRangeDelete(range.id);
                    setAssetMenu(null);
                  }}
                >
                  <Trash2 size={13} />
                  에셋 제거
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* 클립 컨텍스트 메뉴 */}
      {contextMenu && (
        <ClipContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipIndex={contextMenu.clipIndex}
          canMerge={contextMenu.clipIndex > 0}
          onClose={() => setContextMenu(null)}
          onSplit={() => {
            const clip = clips[contextMenu.clipIndex];
            if (clip) {
              const midSentence = Math.floor(clip.sentences.length / 2) - 1;
              if (midSentence >= 0) onSplitAtWord(contextMenu.clipIndex, midSentence);
            }
          }}
          onMerge={() => onMergeWithPrev(contextMenu.clipIndex)}
          onRegenerateImage={() => onGenerateImage(clips[contextMenu.clipIndex]?.id || '')}
          onRegenerateVideo={() => onGenerateVideo(clips[contextMenu.clipIndex]?.id || '')}
          onDelete={() => onDelete(contextMenu.clipIndex)}
        />
      )}
    </div>
  );
};

export default VrewClipList;
