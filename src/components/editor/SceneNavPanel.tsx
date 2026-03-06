/**
 * SceneNavPanel — 씬 네비게이션 패널 (나레이션 모드)
 *
 * Vrew의 중앙 씬 리스트를 접힘 가능한 패널로 구현.
 * 씬 제목 + 썸네일 + 시간 + 클릭으로 해당 씬 클립으로 스크롤.
 */
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EditorClip, MediaRange } from './types';

interface SceneNavPanelProps {
  clips: EditorClip[];
  currentClipIndex: number;
  onClipSelect: (index: number) => void;
  mediaRanges?: MediaRange[];
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SceneNavPanel: React.FC<SceneNavPanelProps> = ({
  clips,
  currentClipIndex,
  onClipSelect,
  mediaRanges,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // mediaRange 기반 이미지 조회 (에셋 삭제 반영)
  const getRangeImage = (clipIndex: number): string => {
    if (!mediaRanges || mediaRanges.length === 0) return clips[clipIndex]?.imageUrl || '';
    const range = mediaRanges.find(
      (r) =>
        (r.type === 'image' || r.type === 'video') &&
        clipIndex >= r.startClipIndex &&
        clipIndex <= r.endClipIndex
    );
    return range?.url || '';  // 044: range 없으면 빈 문자열 → 검정 표시
  };

  // 씬 그룹 (sceneId 기준)
  const scenes = useMemo(() => {
    const groups: {
      sceneId: string;
      startIndex: number;
      text: string;
      imageUrl: string;
      startTime: number;
      totalDuration: number;
    }[] = [];
    let i = 0;
    while (i < clips.length) {
      const sceneId = clips[i].sceneId;
      const start = i;
      let dur = 0;
      while (i < clips.length && clips[i].sceneId === sceneId) {
        dur += clips[i].duration;
        i++;
      }
      groups.push({
        sceneId,
        startIndex: start,
        text: clips[start].text,
        imageUrl: getRangeImage(start),
        startTime: clips[start].audioStartTime,
        totalDuration: dur,
      });
    }
    return groups;
  }, [clips, mediaRanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 활성 씬 찾기
  const activeSceneId = clips[currentClipIndex]?.sceneId;

  if (collapsed) {
    return (
      <div className="scene-nav-panel scene-nav-panel--collapsed">
        <button
          className="scene-nav-panel__toggle"
          onClick={() => setCollapsed(false)}
          title="씬 목록 펴기"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="scene-nav-panel">
      <div className="scene-nav-panel__header">
        <span className="scene-nav-panel__title">씬 ({scenes.length})</span>
        <button
          className="scene-nav-panel__toggle"
          onClick={() => setCollapsed(true)}
          title="씬 목록 접기"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
      <div className="scene-nav-panel__list">
        {scenes.map((scene, idx) => (
          <div
            key={scene.sceneId}
            className={[
              'scene-nav-panel__item',
              activeSceneId === scene.sceneId ? 'scene-nav-panel__item--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onClipSelect(scene.startIndex)}
          >
            <div className="scene-nav-panel__thumb">
              {scene.imageUrl ? (
                <img src={scene.imageUrl} alt={`씬 ${idx + 1}`} />
              ) : (
                <span className="scene-nav-panel__thumb-num">#{idx + 1}</span>
              )}
            </div>
            <div className="scene-nav-panel__info">
              <span className="scene-nav-panel__scene-num">#{idx + 1}</span>
              <span className="scene-nav-panel__scene-text">
                {scene.text.length > 20 ? scene.text.slice(0, 20) + '\u2026' : scene.text}
              </span>
              <span className="scene-nav-panel__scene-time">
                {formatTime(scene.startTime)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SceneNavPanel;
