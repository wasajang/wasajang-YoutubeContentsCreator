/**
 * EditorTimeline — CapCut 스타일 멀티트랙 타임라인 (v3)
 *
 * v3 변경:
 *   - 시네마틱 모드: 음성/자막 트랙을 독립 아이템 기반으로 렌더링
 *   - 나레이션 모드: 기존 클립 기반 렌더링 유지
 *   - 음성/자막 트랙에 마우스 오버 → + 버튼 (1초 단위)
 *   - 자막 아이템 리사이즈 핸들 (양쪽 끝 드래그)
 *
 * 유지: GPU 플레이헤드, 휠 줌, 씬 삽입, 드래그 이동, 눈금자 시간 이동
 */
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Film, Volume2, Type, Trash2, Plus, X } from 'lucide-react';
import type { EditorClip, AudioItem, SubtitleItem } from './types';

const MIN_PPS = 10;
const MAX_PPS = 200;

interface EditorTimelineProps {
  clips: EditorClip[];
  currentClipIndex: number;
  currentTime: number;
  totalDuration: number;
  onClipSelect: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDeleteClip?: (index: number) => void;
  onSeek?: (time: number) => void;
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  onPpsChange?: (getter: () => number) => void;
  onInsertScene?: (afterIndex: number) => void;
  mode?: 'cinematic' | 'narration';
  // 시네마틱 멀티트랙 props
  audioItems?: AudioItem[];
  subtitleItems?: SubtitleItem[];
  onAddAudio?: (startTime: number) => void;
  onAddSubtitle?: (startTime: number) => void;
  onDeleteAudio?: (id: string) => void;
  onDeleteSubtitle?: (id: string) => void;
  onResizeSubtitle?: (id: string, startTime: number, endTime: number) => void;
  onEditSubtitleText?: (id: string, text: string) => void;
  onMoveAudio?: (id: string, newStartTime: number) => void;
  onMoveSubtitle?: (id: string, newStartTime: number) => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function getTickInterval(pps: number): number {
  if (pps >= 150) return 0.5;
  if (pps >= 80) return 1;
  if (pps >= 40) return 5;
  if (pps >= 20) return 10;
  return 30;
}

const EditorTimeline: React.FC<EditorTimelineProps> = ({
  clips,
  currentClipIndex,
  currentTime,
  totalDuration,
  onClipSelect,
  onReorder,
  onDeleteClip,
  onSeek,
  playheadRef,
  onPpsChange,
  onInsertScene,
  mode,
  audioItems,
  subtitleItems,
  onAddAudio,
  onAddSubtitle,
  onDeleteAudio,
  onDeleteSubtitle,
  onResizeSubtitle,
  onEditSubtitleText,
  onMoveAudio,
  onMoveSubtitle,
}) => {
  const label = mode === 'narration' ? '클립' : '씬';
  const isCinematic = mode === 'cinematic';

  // ── 줌 상태 ──
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  const ppsRef = useRef(pixelsPerSecond);

  useEffect(() => { ppsRef.current = pixelsPerSecond; }, [pixelsPerSecond]);
  useEffect(() => { if (onPpsChange) onPpsChange(() => ppsRef.current); }, [onPpsChange]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const totalWidth = useMemo(
    () => Math.max(totalDuration * pixelsPerSecond, 200),
    [totalDuration, pixelsPerSecond],
  );

  const timeMarkers = useMemo(() => {
    const interval = getTickInterval(pixelsPerSecond);
    const markers: number[] = [];
    for (let t = 0; t <= totalDuration + 0.001; t += interval) {
      markers.push(parseFloat(t.toFixed(2)));
    }
    return markers;
  }, [totalDuration, pixelsPerSecond]);

  // ── 휠 줌 ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setPixelsPerSecond((prev) => {
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      return Math.min(MAX_PPS, Math.max(MIN_PPS, prev * factor));
    });
  }, []);

  // ── 플레이헤드 ──
  const playheadPx = useMemo(
    () => (totalDuration > 0 ? (currentTime / totalDuration) * totalWidth : 0),
    [currentTime, totalDuration, totalWidth],
  );
  useEffect(() => {
    if (playheadRef?.current) {
      playheadRef.current.style.transform = `translateX(${playheadPx}px)`;
    }
  }, [playheadPx, playheadRef]);

  // ── 자동 스크롤 ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const margin = 80;
    const viewStart = el.scrollLeft;
    const viewEnd = el.scrollLeft + el.clientWidth;
    if (playheadPx < viewStart + margin || playheadPx > viewEnd - margin) {
      el.scrollTo({ left: Math.max(0, playheadPx - el.clientWidth / 2), behavior: 'smooth' });
    }
  }, [playheadPx]);

  // ── 드래그 상태 ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex && onReorder) onReorder(dragIndex, toIndex);
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, onReorder]);
  const handleDragEnd = useCallback(() => { setDragIndex(null); setDropIndex(null); }, []);

  // ── 눈금자 클릭 ──
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || totalDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const time = Math.max(0, Math.min(totalDuration, px / pixelsPerSecond));
    onSeek(time);
  }, [onSeek, totalDuration, pixelsPerSecond]);

  // ── 블록 공통 ──
  const getBlockClass = (base: string, index: number, extra?: string) => {
    let cls = `vrew-timeline__block ${base}`;
    if (index === currentClipIndex) cls += ' vrew-timeline__block--active';
    if (index === dragIndex) cls += ' vrew-timeline__block--dragging';
    if (index === dropIndex && index !== dragIndex) cls += ' vrew-timeline__block--drag-over';
    if (extra) cls += ` ${extra}`;
    return cls;
  };
  const blockWidth = (duration: number) => `${duration * pixelsPerSecond}px`;

  // ── 씬 삽입 (CSS :hover로 처리, JS 상태 불필요) ──

  // ── 독립 트랙: + 버튼 호버 시간 ──
  const [audioHoverTime, setAudioHoverTime] = useState<number | null>(null);
  const [subtitleHoverTime, setSubtitleHoverTime] = useState<number | null>(null);

  const handleTrackMouseMove = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    existingItems: { startTime: number; endTime: number }[] | undefined,
    setHover: (t: number | null) => void,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const time = Math.floor(px / pixelsPerSecond); // 1초 단위 스냅
    const items = existingItems || [];
    const overlaps = items.some((item) => time >= item.startTime && time < item.endTime);
    setHover(overlaps || time < 0 || time >= totalDuration ? null : time);
  }, [pixelsPerSecond, totalDuration]);

  // ── 아이템 드래그 이동 ──
  const itemDragRef = useRef<{
    type: 'audio' | 'subtitle';
    id: string;
    startX: number;
    origStart: number;
    duration: number;
  } | null>(null);

  const handleItemDragStart = useCallback((
    e: React.MouseEvent,
    type: 'audio' | 'subtitle',
    id: string,
    startTime: number,
    endTime: number,
  ) => {
    // 리사이즈 핸들에서 시작된 경우 무시
    if ((e.target as HTMLElement).classList.contains('vrew-timeline__resize-handle')) return;
    e.preventDefault();
    itemDragRef.current = {
      type,
      id,
      startX: e.clientX,
      origStart: startTime,
      duration: endTime - startTime,
    };

    const handleMove = (me: MouseEvent) => {
      if (!itemDragRef.current) return;
      const dx = me.clientX - itemDragRef.current.startX;
      const dt = dx / pixelsPerSecond;
      const { type: t, id: itemId, origStart, duration: dur } = itemDragRef.current;
      // 0.5초 단위 스냅
      const newStart = Math.max(0, Math.round((origStart + dt) * 2) / 2);
      const newEnd = newStart + dur;
      if (newEnd > totalDuration + 0.1) return; // 범위 초과 방지

      if (t === 'audio' && onMoveAudio) {
        onMoveAudio(itemId, newStart);
      } else if (t === 'subtitle' && onMoveSubtitle) {
        onMoveSubtitle(itemId, newStart);
      }
    };
    const handleUp = () => {
      itemDragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [pixelsPerSecond, totalDuration, onMoveAudio, onMoveSubtitle]);

  // ── 자막 리사이즈 ──
  const resizeRef = useRef<{
    id: string;
    side: 'left' | 'right';
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    item: SubtitleItem,
    side: 'left' | 'right',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      id: item.id,
      side,
      startX: e.clientX,
      origStart: item.startTime,
      origEnd: item.endTime,
    };

    const handleMove = (me: MouseEvent) => {
      if (!resizeRef.current || !onResizeSubtitle) return;
      const dx = me.clientX - resizeRef.current.startX;
      const dt = dx / pixelsPerSecond;
      const { id, side: s, origStart, origEnd } = resizeRef.current;

      if (s === 'left') {
        const newStart = Math.max(0, Math.round((origStart + dt) * 2) / 2); // 0.5초 스냅
        if (newStart < origEnd - 0.5) onResizeSubtitle(id, newStart, origEnd);
      } else {
        const newEnd = Math.min(totalDuration, Math.round((origEnd + dt) * 2) / 2);
        if (newEnd > origStart + 0.5) onResizeSubtitle(id, origStart, newEnd);
      }
    };
    const handleUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [pixelsPerSecond, totalDuration, onResizeSubtitle]);

  // ── 자막 인라인 편집 ──
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  return (
    <div className="vrew-timeline" onWheel={handleWheel}>
      <div className="vrew-timeline__layout">

        {/* 왼쪽: 고정 라벨 열 */}
        <div className="vrew-timeline__labels">
          <div className="vrew-timeline__ruler-label" />
          <div className="vrew-timeline__track-label">
            <Film size={12} /> 영상
          </div>
          <div className="vrew-timeline__track-label">
            <Volume2 size={12} /> 음성
          </div>
          <div className="vrew-timeline__track-label">
            <Type size={12} /> 자막
          </div>
        </div>

        {/* 오른쪽: 가로 스크롤 영역 */}
        <div className="vrew-timeline__scroll" ref={scrollRef}>
          <div className="vrew-timeline__inner" style={{ width: `${totalWidth}px` }}>

            {/* 시간 눈금자 */}
            <div
              className="vrew-timeline__ruler"
              style={{ width: `${totalWidth}px` }}
              onClick={handleRulerClick}
            >
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="vrew-timeline__ruler-mark"
                  style={{ left: `${t * pixelsPerSecond}px` }}
                >
                  <span>{formatTime(t)}</span>
                </div>
              ))}
              {playheadRef ? (
                <div
                  ref={playheadRef}
                  className="vrew-timeline__playhead vrew-timeline__playhead--gpu"
                  style={{ transform: `translateX(${playheadPx}px)` }}
                />
              ) : (
                <div
                  className="vrew-timeline__playhead"
                  style={{ left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
                />
              )}
            </div>

            {/* ═══ 영상 트랙 (변경 없음) ═══ */}
            <div className="vrew-timeline__track vrew-timeline__track--video-row">
              {clips.map((clip, index) => (
                <React.Fragment key={`v-${clip.id}`}>
                  <div
                    className={getBlockClass('vrew-timeline__block--video', index)}
                    style={{ width: blockWidth(clip.duration), flexShrink: 0 }}
                    onClick={() => onClipSelect(index)}
                    draggable={!!onReorder}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    {clip.imageUrl ? (
                      <img src={clip.imageUrl} alt={clip.label} className="vrew-timeline__block-thumb" />
                    ) : (
                      <span className="vrew-timeline__block-num">{index + 1}</span>
                    )}
                    {clip.videoUrl && <span className="vrew-timeline__block-video-badge">&#9654;</span>}
                    <span className="vrew-timeline__block-dur">{clip.duration.toFixed(1)}s</span>
                    {onDeleteClip && (
                      <button
                        className="vrew-timeline__block-delete"
                        onClick={(e) => { e.stopPropagation(); onDeleteClip(index); }}
                        title={`${label} 삭제`}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  {onInsertScene && index < clips.length - 1 && (
                    <div
                      className="vrew-timeline__insert-zone"
                      onClick={(e) => { e.stopPropagation(); onInsertScene(index); }}
                    >
                      <button className="vrew-timeline__insert-btn" title={`${label} 삽입`}>
                        <Plus size={10} />
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ═══ 음성 트랙 ═══ */}
            <div className="vrew-timeline__track vrew-timeline__track--audio-row">
              {isCinematic && audioItems !== undefined ? (
                /* 시네마틱: 독립 아이템 기반 */
                <div
                  className="vrew-timeline__absolute-track"
                  style={{ width: `${totalWidth}px` }}
                  onMouseMove={(e) => handleTrackMouseMove(e, audioItems, setAudioHoverTime)}
                  onMouseLeave={() => setAudioHoverTime(null)}
                >
                  {/* + 버튼 */}
                  {audioHoverTime !== null && onAddAudio && (
                    <button
                      className="vrew-timeline__track-add-btn"
                      style={{ left: `${audioHoverTime * pixelsPerSecond}px` }}
                      onClick={(e) => { e.stopPropagation(); onAddAudio(audioHoverTime); }}
                      title="음성 추가"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                  {/* 오디오 아이템들 */}
                  {audioItems.map((item) => (
                    <div
                      key={item.id}
                      className="vrew-timeline__audio-item"
                      style={{
                        left: `${item.startTime * pixelsPerSecond}px`,
                        width: `${(item.endTime - item.startTime) * pixelsPerSecond}px`,
                        cursor: 'grab',
                      }}
                      onMouseDown={(e) => handleItemDragStart(e, 'audio', item.id, item.startTime, item.endTime)}
                    >
                      <Volume2 size={10} />
                      <span className="vrew-timeline__item-text">
                        {item.text.length > 15 ? item.text.slice(0, 15) + '\u2026' : item.text}
                      </span>
                      {onDeleteAudio && (
                        <button
                          className="vrew-timeline__item-delete"
                          onClick={(e) => { e.stopPropagation(); onDeleteAudio(item.id); }}
                        >
                          <X size={8} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* 나레이션: 기존 클립 기반 */
                clips.map((clip, index) => (
                  <div
                    key={`a-${clip.id}`}
                    className={getBlockClass(
                      'vrew-timeline__block--audio',
                      index,
                      clip.audioUrl ? 'vrew-timeline__block--has-audio' : '',
                    )}
                    style={{ width: blockWidth(clip.duration), flexShrink: 0 }}
                    onClick={() => onClipSelect(index)}
                  >
                    <span className="vrew-timeline__block-text">
                      {clip.audioUrl ? 'TTS' : '\u2014'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* ═══ 자막 트랙 ═══ */}
            <div className="vrew-timeline__track vrew-timeline__track--subtitle-row">
              {isCinematic && subtitleItems !== undefined ? (
                /* 시네마틱: 독립 아이템 기반 */
                <div
                  className="vrew-timeline__absolute-track"
                  style={{ width: `${totalWidth}px` }}
                  onMouseMove={(e) => handleTrackMouseMove(e, subtitleItems, setSubtitleHoverTime)}
                  onMouseLeave={() => setSubtitleHoverTime(null)}
                >
                  {/* + 버튼 */}
                  {subtitleHoverTime !== null && onAddSubtitle && (
                    <button
                      className="vrew-timeline__track-add-btn"
                      style={{ left: `${subtitleHoverTime * pixelsPerSecond}px` }}
                      onClick={(e) => { e.stopPropagation(); onAddSubtitle(subtitleHoverTime); }}
                      title="자막 추가"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                  {/* 자막 아이템들 */}
                  {subtitleItems.map((item) => (
                    <div
                      key={item.id}
                      className="vrew-timeline__subtitle-item"
                      style={{
                        left: `${item.startTime * pixelsPerSecond}px`,
                        width: `${(item.endTime - item.startTime) * pixelsPerSecond}px`,
                        cursor: 'grab',
                      }}
                      onMouseDown={(e) => handleItemDragStart(e, 'subtitle', item.id, item.startTime, item.endTime)}
                    >
                      {/* 왼쪽 리사이즈 핸들 */}
                      <div
                        className="vrew-timeline__resize-handle vrew-timeline__resize-handle--left"
                        onMouseDown={(e) => handleResizeStart(e, item, 'left')}
                      />
                      {/* 텍스트 (더블클릭으로 편집) */}
                      {editingSubId === item.id ? (
                        <input
                          className="vrew-timeline__subtitle-input"
                          autoFocus
                          defaultValue={item.text}
                          onBlur={(e) => {
                            onEditSubtitleText?.(item.id, e.target.value);
                            setEditingSubId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onEditSubtitleText?.(item.id, (e.target as HTMLInputElement).value);
                              setEditingSubId(null);
                            }
                            if (e.key === 'Escape') setEditingSubId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="vrew-timeline__item-text"
                          onDoubleClick={() => setEditingSubId(item.id)}
                        >
                          {item.text || '자막 텍스트'}
                        </span>
                      )}
                      {/* 오른쪽 리사이즈 핸들 */}
                      <div
                        className="vrew-timeline__resize-handle vrew-timeline__resize-handle--right"
                        onMouseDown={(e) => handleResizeStart(e, item, 'right')}
                      />
                      {onDeleteSubtitle && (
                        <button
                          className="vrew-timeline__item-delete"
                          onClick={(e) => { e.stopPropagation(); onDeleteSubtitle(item.id); }}
                        >
                          <X size={8} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* 나레이션: 기존 클립 기반 */
                clips.map((clip, index) => (
                  <div
                    key={`s-${clip.id}`}
                    className={getBlockClass('vrew-timeline__block--subtitle', index)}
                    style={{ width: blockWidth(clip.duration), flexShrink: 0 }}
                    onClick={() => onClipSelect(index)}
                  >
                    <span className="vrew-timeline__block-text">
                      {clip.text.length > 20 ? clip.text.slice(0, 20) + '\u2026' : clip.text}
                    </span>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorTimeline;
