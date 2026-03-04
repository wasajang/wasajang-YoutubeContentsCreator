/**
 * EditorTimeline — CapCut 스타일 3트랙 가로 타임라인 (v2)
 *
 * Part A: GPU 플레이헤드 (transform: translateX, will-change, playheadRef)
 * Part B: 마우스 휠 줌 (pixelsPerSecond, 눈금자 동적 간격, overflow-x 스크롤)
 * Part C: 씬 삽입 버튼 (영상 트랙 블록 사이 호버 + 버튼)
 * 유지: 드래그 이동, 클립 삭제, 눈금자 클릭 시간 이동, 자동 스크롤
 */
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Film, Volume2, Type, Trash2, Plus } from 'lucide-react';
import type { EditorClip } from './types';

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
  // Part A: GPU 플레이헤드
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  // Part B: pixelsPerSecond getter 외부 전달
  onPpsChange?: (getter: () => number) => void;
  // Part C: 씬 삽입
  onInsertScene?: (afterIndex: number) => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** 줌 레벨에 따른 눈금 간격 (초) */
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
}) => {
  // ── Part B: 줌 상태 ──────────────────────────────────────────────
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40);
  const ppsRef = useRef(pixelsPerSecond);

  useEffect(() => {
    ppsRef.current = pixelsPerSecond;
  }, [pixelsPerSecond]);

  // getter를 외부에 전달
  useEffect(() => {
    if (onPpsChange) {
      onPpsChange(() => ppsRef.current);
    }
  }, [onPpsChange]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 전체 너비 (px)
  const totalWidth = useMemo(
    () => Math.max(totalDuration * pixelsPerSecond, 200),
    [totalDuration, pixelsPerSecond],
  );

  // 눈금자 마커 목록
  const timeMarkers = useMemo(() => {
    const interval = getTickInterval(pixelsPerSecond);
    const markers: number[] = [];
    for (let t = 0; t <= totalDuration + 0.001; t += interval) {
      markers.push(parseFloat(t.toFixed(2)));
    }
    return markers;
  }, [totalDuration, pixelsPerSecond]);

  // ── 휠 줌 ──────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setPixelsPerSecond((prev) => {
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      return Math.min(MAX_PPS, Math.max(MIN_PPS, prev * factor));
    });
  }, []);

  // ── Part A: 플레이헤드 위치 (px) ────────────────────────────────
  const playheadPx = useMemo(
    () => (totalDuration > 0 ? (currentTime / totalDuration) * totalWidth : 0),
    [currentTime, totalDuration, totalWidth],
  );

  // playheadRef 가 있으면 직접 DOM 조작 (GPU 가속)
  useEffect(() => {
    if (playheadRef?.current) {
      playheadRef.current.style.transform = `translateX(${playheadPx}px)`;
    }
  }, [playheadPx, playheadRef]);

  // ── 자동 스크롤 ─────────────────────────────────────────────────
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

  // ── 드래그 상태 ──────────────────────────────────────────────────
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

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== toIndex && onReorder) {
        onReorder(dragIndex, toIndex);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  // ── 눈금자 클릭 → 시간 이동 ──────────────────────────────────────
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || totalDuration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const time = Math.max(0, Math.min(totalDuration, px / pixelsPerSecond));
      onSeek(time);
    },
    [onSeek, totalDuration, pixelsPerSecond],
  );

  // ── 블록 클래스 생성 (공통) ───────────────────────────────────────
  const getBlockClass = (base: string, index: number, extra?: string) => {
    let cls = `vrew-timeline__block ${base}`;
    if (index === currentClipIndex) cls += ' vrew-timeline__block--active';
    if (index === dragIndex) cls += ' vrew-timeline__block--dragging';
    if (index === dropIndex && index !== dragIndex) cls += ' vrew-timeline__block--drag-over';
    if (extra) cls += ` ${extra}`;
    return cls;
  };

  // ── 블록 너비 계산 ─────────────────────────────────────────────
  const blockWidth = (duration: number) => `${duration * pixelsPerSecond}px`;

  // ── 씬 삽입 버튼 표시 상태 ───────────────────────────────────────
  const [insertHoverIndex, setInsertHoverIndex] = useState<number | null>(null);

  return (
    <div className="vrew-timeline" onWheel={handleWheel}>
      {/* ── 라벨 + 스크롤 2열 레이아웃 ── */}
      <div className="vrew-timeline__layout">

        {/* 왼쪽: 고정 라벨 열 */}
        <div className="vrew-timeline__labels">
          {/* ruler 라벨 (빈 칸) */}
          <div className="vrew-timeline__ruler-label" />
          {/* 영상 트랙 라벨 */}
          <div className="vrew-timeline__track-label">
            <Film size={12} /> 영상
          </div>
          {/* 음성 트랙 라벨 */}
          <div className="vrew-timeline__track-label">
            <Volume2 size={12} /> 음성
          </div>
          {/* 자막 트랙 라벨 */}
          <div className="vrew-timeline__track-label">
            <Type size={12} /> 자막
          </div>
        </div>

        {/* 오른쪽: 가로 스크롤 영역 */}
        <div
          className="vrew-timeline__scroll"
          ref={scrollRef}
        >
          {/* 내부 고정 너비 컨테이너 */}
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
              {/* Part A: GPU 플레이헤드 */}
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

            {/* 영상 트랙 */}
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
                      <img
                        src={clip.imageUrl}
                        alt={clip.label}
                        className="vrew-timeline__block-thumb"
                      />
                    ) : (
                      <span className="vrew-timeline__block-num">{index + 1}</span>
                    )}
                    {clip.videoUrl && (
                      <span className="vrew-timeline__block-video-badge">&#9654;</span>
                    )}
                    <span className="vrew-timeline__block-dur">
                      {clip.duration.toFixed(1)}s
                    </span>
                    {onDeleteClip && (
                      <button
                        className="vrew-timeline__block-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClip(index);
                        }}
                        title="클립 삭제"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>

                  {/* Part C: 씬 삽입 버튼 — 마지막 블록 뒤에는 표시 안 함 */}
                  {onInsertScene && index < clips.length - 1 && (
                    <div
                      className={`vrew-timeline__insert-zone${insertHoverIndex === index ? ' vrew-timeline__insert-zone--visible' : ''}`}
                      onMouseEnter={() => setInsertHoverIndex(index)}
                      onMouseLeave={() => setInsertHoverIndex(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertScene(index);
                      }}
                    >
                      <button className="vrew-timeline__insert-btn" title="씬 삽입">
                        <Plus size={10} />
                      </button>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 음성 트랙 */}
            <div className="vrew-timeline__track">
              {clips.map((clip, index) => (
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
              ))}
            </div>

            {/* 자막 트랙 */}
            <div className="vrew-timeline__track">
              {clips.map((clip, index) => (
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
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorTimeline;
