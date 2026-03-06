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
  // 046: 히스토리 스택을 ref로 관리 (동기 읽기/쓰기 보장 — useState 콜백 타이밍 문제 해결)
  const pastRef = useRef<Snapshot<T>[]>([]);
  const futureRef = useRef<Snapshot<T>[]>([]);
  const isRestoringRef = useRef(false);

  // UI용 가능 여부 상태 (버튼 활성화/비활성화)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** ref 변경 후 UI 상태 동기화 */
  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const pushState = useCallback((state: T) => {
    // 복원 중에는 히스토리에 기록하지 않음
    if (isRestoringRef.current) return;
    const next = [...pastRef.current, { data: state, timestamp: Date.now() }];
    pastRef.current = next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    futureRef.current = []; // 새 액션 시 redo 스택 클리어
    syncFlags();
  }, [syncFlags]);

  const undo = useCallback((): T | null => {
    if (pastRef.current.length === 0) return null;
    const newPast = [...pastRef.current];
    const snapshot = newPast.pop()!;
    pastRef.current = newPast;
    futureRef.current = [...futureRef.current, snapshot];
    syncFlags();

    isRestoringRef.current = true;
    onRestore(snapshot.data);
    isRestoringRef.current = false;
    return snapshot.data;
  }, [onRestore, syncFlags]);

  const redo = useCallback((): T | null => {
    if (futureRef.current.length === 0) return null;
    const newFuture = [...futureRef.current];
    const snapshot = newFuture.pop()!;
    futureRef.current = newFuture;
    pastRef.current = [...pastRef.current, snapshot];
    syncFlags();

    isRestoringRef.current = true;
    onRestore(snapshot.data);
    isRestoringRef.current = false;
    return snapshot.data;
  }, [onRestore, syncFlags]);

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
    canUndo,
    canRedo,
  };
}
