/**
 * useEditorHistory — 편집기 Undo/Redo 히스토리 관리
 *
 * 상태 스냅샷을 저장하고, Ctrl+Z / Ctrl+Shift+Z로 되돌리기/다시실행
 */
import { useState, useCallback, useEffect, useRef } from 'react';

interface Snapshot<T> {
  data: T;
  timestamp: number;
}

interface UseEditorHistoryReturn<T> {
  /** 현재 상태를 히스토리에 기록 */
  pushState: (state: T) => void;
  /** 되돌리기 (Ctrl+Z) — 이전 상태 반환, 없으면 null */
  undo: () => T | null;
  /** 다시실행 (Ctrl+Shift+Z) — 다음 상태 반환, 없으면 null */
  redo: () => T | null;
  /** 되돌리기 가능 여부 */
  canUndo: boolean;
  /** 다시실행 가능 여부 */
  canRedo: boolean;
}

const MAX_HISTORY = 50;

export function useEditorHistory<T>(
  /** 히스토리에서 상태를 복원할 때 호출되는 콜백 */
  onRestore: (state: T) => void,
): UseEditorHistoryReturn<T> {
  const [past, setPast] = useState<Snapshot<T>[]>([]);
  const [future, setFuture] = useState<Snapshot<T>[]>([]);
  const isRestoringRef = useRef(false);

  const pushState = useCallback((state: T) => {
    // 복원 중에는 히스토리에 기록하지 않음
    if (isRestoringRef.current) return;
    setPast(prev => {
      const next = [...prev, { data: state, timestamp: Date.now() }];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setFuture([]); // 새 액션 시 redo 스택 클리어
  }, []);

  const undo = useCallback((): T | null => {
    let restored: T | null = null;
    setPast(prev => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      const snapshot = newPast.pop()!;
      restored = snapshot.data;
      setFuture(f => [...f, snapshot]);
      return newPast;
    });
    if (restored !== null) {
      isRestoringRef.current = true;
      onRestore(restored);
      isRestoringRef.current = false;
    }
    return restored;
  }, [onRestore]);

  const redo = useCallback((): T | null => {
    let restored: T | null = null;
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      const snapshot = newFuture.pop()!;
      restored = snapshot.data;
      setPast(p => [...p, snapshot]);
      return newFuture;
    });
    if (restored !== null) {
      isRestoringRef.current = true;
      onRestore(restored);
      isRestoringRef.current = false;
    }
    return restored;
  }, [onRestore]);

  // Ctrl+Z / Ctrl+Shift+Z 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      // Ctrl+Y도 redo로 지원
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    pushState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
