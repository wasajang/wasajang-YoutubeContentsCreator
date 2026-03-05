// ClipContextMenu — 클립 우클릭 컨텍스트 메뉴
import React, { useEffect } from 'react';
import { Scissors, Link, Image, Video, Trash2 } from 'lucide-react';

interface ClipContextMenuProps {
  x: number;
  y: number;
  clipIndex: number;
  canMerge: boolean;
  onClose: () => void;
  onSplit: () => void;
  onMerge: () => void;
  onRegenerateImage: () => void;
  onRegenerateVideo: () => void;
  onDelete: () => void;
}

const ClipContextMenu: React.FC<ClipContextMenuProps> = ({
  x,
  y,
  clipIndex: _clipIndex,
  canMerge,
  onClose,
  onSplit,
  onMerge,
  onRegenerateImage,
  onRegenerateVideo,
  onDelete,
}) => {
  // ESC 키로 닫힘
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleItemClick = (callback: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    callback();
    onClose();
  };

  return (
    <>
      {/* 배경 오버레이 — 클릭 시 닫힘 */}
      <div
        className="clip-context-menu__overlay"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* 메뉴 본체 */}
      <div
        className="clip-context-menu"
        style={{ top: y, left: x }}
        role="menu"
        aria-label="클립 메뉴"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 나누기 */}
        <button
          className="clip-context-menu__item"
          role="menuitem"
          onClick={handleItemClick(onSplit)}
        >
          <Scissors size={13} />
          여기서 나누기
        </button>

        {/* 합치기 (index > 0일 때만) */}
        {canMerge && (
          <button
            className="clip-context-menu__item"
            role="menuitem"
            onClick={handleItemClick(onMerge)}
          >
            <Link size={13} />
            이전 클립과 합치기
          </button>
        )}

        <div className="clip-context-menu__divider" />

        {/* 이미지 재생성 */}
        <button
          className="clip-context-menu__item"
          role="menuitem"
          onClick={handleItemClick(onRegenerateImage)}
        >
          <Image size={13} />
          이미지 재생성
        </button>

        {/* 영상 재생성 */}
        <button
          className="clip-context-menu__item"
          role="menuitem"
          onClick={handleItemClick(onRegenerateVideo)}
        >
          <Video size={13} />
          영상 재생성
        </button>

        <div className="clip-context-menu__divider" />

        {/* 삭제 */}
        <button
          className="clip-context-menu__item clip-context-menu__item--danger"
          role="menuitem"
          onClick={handleItemClick(onDelete)}
        >
          <Trash2 size={13} />
          삭제
        </button>
      </div>
    </>
  );
};

export default ClipContextMenu;
