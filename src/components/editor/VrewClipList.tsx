// VrewClipList — 클립 카드 리스트 + 에셋 셀 (flex row) + 씬 헤더
// 043: absolute 오버레이 → flex row 에셋 셀로 근본 변경 (겹침 원천 차단)
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Image, Video, ChevronDown, ChevronRight, RefreshCw, Trash2, MoreHorizontal, Plus } from 'lucide-react';
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
  onAddAssetForClip?: (clipIndex: number) => void;
}

/** 각 클립 행의 에셋 셀 정보 계산 */
function computeAssetCellInfo(
  clipIndex: number,
  ranges: MediaRange[],
  selectedRangeId: string | null,
  hoveredRangeId: string | null,
  dragLiveRange: { rangeId: string; startClipIndex: number; endClipIndex: number } | null,
): {
  range: MediaRange | null;
  position: 'start' | 'middle' | 'end' | 'single' | 'none';
  isSelected: boolean;
  isHovered: boolean;
} {
  // 드래그 중이면 라이브 범위 사용
  for (const r of ranges) {
    const live = dragLiveRange?.rangeId === r.id ? dragLiveRange : null;
    const start = live ? live.startClipIndex : r.startClipIndex;
    const end = live ? live.endClipIndex : r.endClipIndex;

    if (clipIndex >= start && clipIndex <= end) {
      const isSingle = start === end;
      const isStart = clipIndex === start;
      const isEnd = clipIndex === end;

      let position: 'start' | 'middle' | 'end' | 'single' | 'none';
      if (isSingle) position = 'single';
      else if (isStart) position = 'start';
      else if (isEnd) position = 'end';
      else position = 'middle';

      return {
        range: r,
        position,
        isSelected: selectedRangeId === r.id,
        isHovered: hoveredRangeId === r.id && selectedRangeId !== r.id,
      };
    }
  }
  return { range: null, position: 'none', isSelected: false, isHovered: false };
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
  onAddAssetForClip,
}) => {
  // 클립 카드 ref (자동 스크롤 + 드래그 리사이즈용)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);

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

  // 에셋 선택/호버 상태 (Vrew 스타일: 선택=파란색, 호버=회색)
  const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);
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

  // 044: 에셋 썸네일 클릭 → 선택만 (메뉴 없음, 오버레이 없음 → 드래그 핸들 즉시 사용 가능)
  const handleAssetIconClick = useCallback((e: React.MouseEvent, rangeId: string) => {
    e.stopPropagation();
    setSelectedRangeId(selectedRangeId === rangeId ? null : rangeId);
    setAssetMenu(null);
  }, [selectedRangeId]);

  // 044: ... 아이콘 클릭 → 메뉴 표시 (별도 핸들러)
  const handleAssetMenuClick = useCallback((e: React.MouseEvent, rangeId: string) => {
    e.stopPropagation();
    setSelectedRangeId(rangeId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAssetMenu({ rangeId, x: rect.right + 4, y: rect.top });
  }, []);

  // 외부 클릭 시 에셋 선택 해제
  useEffect(() => {
    if (!selectedRangeId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.vrew-clip-list__asset-cell') || t.closest('.clip-context-menu')) return;
      setSelectedRangeId(null);
      setAssetMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedRangeId]);

  // 045: Delete/Backspace 키로 선택된 에셋 삭제
  useEffect(() => {
    if (!selectedRangeId || !onMediaRangeDelete) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onMediaRangeDelete(selectedRangeId);
        setSelectedRangeId(null);
        setAssetMenu(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedRangeId, onMediaRangeDelete]);

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

  // 유효한 mediaRange만 필터
  const visualRanges = useMemo(() => {
    if (!mediaRanges || mediaRanges.length === 0) return [] as MediaRange[];
    return mediaRanges.filter(
      (r) => r.startClipIndex < clips.length && r.endClipIndex < clips.length
    );
  }, [mediaRanges, clips.length]);

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

  // 044: MediaRange 기반 이미지 URL 헬퍼 — range 없으면 빈 문자열(검정)
  const getAppliedImage = (clipIndex: number): string => {
    if (visualRanges.length === 0) return clips[clipIndex]?.imageUrl || '';
    const range = visualRanges.find(
      (r) =>
        (r.type === 'image' || r.type === 'video') &&
        clipIndex >= r.startClipIndex &&
        clipIndex <= r.endClipIndex
    );
    return range?.url || '';  // 044: range 없으면 빈 문자열 → 검정 표시
  };

  if (clips.length === 0) {
    return (
      <div className="vrew-clip-list vrew-clip-list--empty">
        <p className="vrew-clip-list__empty-msg">클립이 없습니다.</p>
      </div>
    );
  }

  const hasMediaRanges = visualRanges.length > 0;

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

      {/* 클립 카드 리스트 (에셋 셀은 각 row 내부에 inline flex 형제) */}
      <div className="vrew-clip-list__cards" ref={cardsContainerRef}>
        {clips.map((clip, i) => {
          // 씬 그룹 정보
          const group = sceneGroups.find(g => g.sceneId === clip.sceneId);
          const isFirstOfScene = group?.startIndex === i;
          const isCollapsed = collapsedScenes.has(clip.sceneId);
          const sceneIdx = group ? sceneGroups.indexOf(group) + 1 : i + 1;

          // 접힌 씬의 첫 번째가 아닌 클립은 숨김
          if (!isFirstOfScene && isCollapsed) return null;

          // 에셋 셀 정보 계산 (flex row 내 에셋 칼럼)
          const cellInfo = computeAssetCellInfo(i, visualRanges, selectedRangeId, hoveredRangeId, dragLiveRange);

          const formatSceneTime = (sec: number) => {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          };

          return (
            <React.Fragment key={clip.id}>
              {/* 씬 구분 헤더 */}
              {isFirstOfScene && sceneGroups.length > 1 && (
                <div className="vrew-clip-list__scene-header">
                  {/* 에셋 칼럼 빈 셀 (정렬 유지) */}
                  {hasMediaRanges && <div className="vrew-clip-list__asset-cell vrew-clip-list__asset-cell--header" />}
                  <div className="vrew-clip-list__scene-header-content" onClick={() => toggleSceneCollapse(clip.sceneId)}>
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
                </div>
              )}

              {/* 클립 카드 행 */}
              {!isCollapsed && (
                <div
                  className={[
                    'vrew-clip-list__card-row',
                    cellInfo.isSelected ? 'vrew-clip-list__card-row--selected' : '',
                    cellInfo.isHovered ? 'vrew-clip-list__card-row--hovered' : '',
                  ].filter(Boolean).join(' ')}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  onMouseEnter={() => cellInfo.range && setHoveredRangeId(cellInfo.range.id)}
                  onMouseLeave={() => setHoveredRangeId(null)}
                >
                  {/* ── 에셋 셀 (52px, 썸네일 왼쪽 + 범위바 오른쪽) ── */}
                  {hasMediaRanges && (
                    <div
                      className={[
                        'vrew-clip-list__asset-cell',
                        `vrew-clip-list__asset-cell--${cellInfo.position}`,
                        cellInfo.isSelected ? 'vrew-clip-list__asset-cell--selected' : '',
                        cellInfo.isHovered ? 'vrew-clip-list__asset-cell--hovered' : '',
                      ].filter(Boolean).join(' ')}
                      /* 044: 호버 이벤트는 card-row에서 처리 */
                    >
                      {/* 세로 연결선 */}
                      {cellInfo.position !== 'none' && (
                        <div className="vrew-clip-list__asset-line" />
                      )}

                      {/* 045: 빈 클립 — + 버튼 (에셋 추가) */}
                      {cellInfo.position === 'none' && onAddAssetForClip && (
                        <button
                          className="vrew-clip-list__asset-add-btn"
                          onClick={(e) => { e.stopPropagation(); onAddAssetForClip(i); }}
                          title="이 클립에 에셋 추가"
                        >
                          <Plus size={14} />
                        </button>
                      )}

                      {/* 썸네일 (start 또는 single 위치에만) */}
                      {(cellInfo.position === 'start' || cellInfo.position === 'single') && cellInfo.range && (
                        <div
                          className="vrew-clip-list__asset-thumb"
                          onClick={(e) => handleAssetIconClick(e, cellInfo.range!.id)}
                        >
                          {cellInfo.range.url ? (
                            <img src={cellInfo.range.url} alt={cellInfo.range.type} />
                          ) : cellInfo.range.type === 'video' ? (
                            <Video size={16} color="var(--accent-primary)" />
                          ) : (
                            <Image size={16} color="var(--text-secondary)" />
                          )}
                          {cellInfo.range.type === 'video' && cellInfo.range.url && (
                            <span className="vrew-clip-list__asset-video-badge">
                              <Video size={8} color="#fff" />
                            </span>
                          )}
                          <span
                            className="vrew-clip-list__asset-menu-dot"
                            onClick={(e) => handleAssetMenuClick(e, cellInfo.range!.id)}
                          >
                            <MoreHorizontal size={10} />
                          </span>
                        </div>
                      )}

                      {/* 위쪽 드래그 핸들 (start 또는 single) */}
                      {onMediaRangeResize && (cellInfo.position === 'start' || cellInfo.position === 'single') && cellInfo.range && (
                        <div
                          className="vrew-clip-list__asset-handle vrew-clip-list__asset-handle--top"
                          onMouseDown={(e) => startAssetResize(e, cellInfo.range!.id, 'top', cellInfo.range!.startClipIndex, cellInfo.range!.endClipIndex)}
                          title="위로 드래그하여 범위 확장"
                        />
                      )}

                      {/* 아래쪽 드래그 핸들 (end 또는 single) */}
                      {onMediaRangeResize && (cellInfo.position === 'end' || cellInfo.position === 'single') && cellInfo.range && (
                        <div
                          className="vrew-clip-list__asset-handle vrew-clip-list__asset-handle--bottom"
                          onMouseDown={(e) => startAssetResize(e, cellInfo.range!.id, 'bottom', cellInfo.range!.startClipIndex, cellInfo.range!.endClipIndex)}
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
                      onAddAsset={onAddAssetForClip ? () => onAddAssetForClip(i) : undefined}
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
      {/* 044: 에셋 메뉴 — 오버레이 제거 (드래그 핸들 차단 방지) */}
      {assetMenu && (() => {
        const range = mediaRanges?.find(r => r.id === assetMenu.rangeId);
        if (!range) return null;
        return (
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
                  setSelectedRangeId(null);
                }}
              >
                <Trash2 size={13} />
                에셋 제거
              </button>
            )}
          </div>
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
