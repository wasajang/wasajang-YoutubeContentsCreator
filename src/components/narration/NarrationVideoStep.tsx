/**
 * NarrationVideoStep — Step 6: 선택적 영상화 + Ken Burns 효과 설정
 *
 * - imageUrl이 있는 나레이션 클립 목록을 표시
 * - 체크된 클립: AI 영상 생성 (generateVideo 순차 호출)
 * - 미체크 클립: Ken Burns 효과 드롭다운 선택
 * - 영상 AI 모델 선택 (getUserSelectableModels('video'))
 */
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { NarrationClip } from '../../store/projectStore';
import { generateVideo } from '../../services/ai-video';
import { buildVideoPrompt } from '../../services/prompt-builder';
import { useCredits } from '../../hooks/useCredits';
import { getUserSelectableModels } from '../../data/aiModels';
import { useToast } from '../../hooks/useToast';
import { syncScenesImageToClips } from '../../utils/narration-sync';

interface NarrationVideoStepProps {
  onNext: () => void;
  onPrev?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

const KEN_BURNS_OPTIONS: { value: NarrationClip['effect']; label: string }[] = [
  { value: 'none',       label: '효과 없음' },
  { value: 'zoom-in',    label: '줌 인' },
  { value: 'zoom-out',   label: '줌 아웃' },
  { value: 'pan-left',   label: '패닝 좌' },
  { value: 'pan-right',  label: '패닝 우' },
];

export function NarrationVideoStep({ onNext, onPrev, isModal, onClose }: NarrationVideoStepProps) {
  const narrationClips       = useProjectStore((s) => s.narrationClips);
  const setNarrationClips    = useProjectStore((s) => s.setNarrationClips);
  const scenes               = useProjectStore((s) => s.scenes);
  const aiModelPreferences   = useProjectStore((s) => s.aiModelPreferences);
  const setAiModelPreference = useProjectStore((s) => s.setAiModelPreference);
  const artStyleId           = useProjectStore((s) => s.artStyleId);
  const templateId           = useProjectStore((s) => s.templateId);
  const sceneVideos          = useProjectStore((s) => s.sceneVideos);

  const { canAfford, spend, getCost } = useCredits();
  const { showToast } = useToast();

  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [batchEffect, setBatchEffect]     = useState<NarrationClip['effect']>('zoom-in');
  const syncedRef = useRef(false);
  const shiftKeyRef = useRef(false);

  const videoModels = getUserSelectableModels('video');

  // 마운트 시 scenes → narrationClips 이미지 자동 동기화
  useEffect(() => {
    if (syncedRef.current) return;
    if (narrationClips.length === 0 || scenes.length === 0) return;

    const synced = syncScenesImageToClips(
      scenes.map((s) => ({ id: s.id, imageUrl: s.imageUrl || '' })),
      narrationClips,
    );

    // 실제 변경이 있는 경우에만 업데이트
    const hasChange = synced.some((c, i) => c.imageUrl !== narrationClips[i]?.imageUrl);
    if (hasChange) {
      setNarrationClips(synced);
    }
    syncedRef.current = true;
  }, [scenes, narrationClips, setNarrationClips]);

  // imageUrl이 있는 클립만 표시
  const visibleClips = narrationClips.filter((c) => c.imageUrl);

  // 최초 visibleClips가 채워지면 전체 선택 (한 번만)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (visibleClips.length > 0) {
      setCheckedIds(new Set(visibleClips.map((c) => c.id)));
      initializedRef.current = true;
    }
  }, [visibleClips]);

  const checkedCount   = [...checkedIds].filter((id) => visibleClips.some((c) => c.id === id)).length;
  const kenBurnsCount  = visibleClips.length - checkedCount;
  const estimatedCost  = getCost('video', checkedCount);
  const isGenerating   = generatingIds.size > 0;

  // 체크박스 토글 (Shift+클릭 범위 선택 지원)
  const handleToggleCheck = (clipId: string, clipIndex?: number, shiftKey?: boolean) => {
    if (shiftKey && lastClickedIdx !== null && clipIndex != null) {
      const start = Math.min(lastClickedIdx, clipIndex);
      const end = Math.max(lastClickedIdx, clipIndex);
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (visibleClips[i]) next.add(visibleClips[i].id);
        }
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      });
    }
    if (clipIndex != null) setLastClickedIdx(clipIndex);
  };

  // 전체 선택/해제
  const handleToggleAll = () => {
    if (checkedIds.size === visibleClips.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(visibleClips.map((c) => c.id)));
    }
  };

  // Ken Burns 효과 변경
  const handleEffectChange = (clipId: string, effect: NarrationClip['effect']) => {
    const updated = narrationClips.map((c) =>
      c.id === clipId ? { ...c, effect } : c
    );
    setNarrationClips(updated);
  };

  // 미체크 클립 일괄 Ken Burns 적용
  const handleBatchEffectApply = () => {
    const uncheckedIds = visibleClips
      .filter((c) => !checkedIds.has(c.id))
      .map((c) => c.id);
    if (uncheckedIds.length === 0) return;
    const uncheckedSet = new Set(uncheckedIds);
    const updated = narrationClips.map((c) =>
      uncheckedSet.has(c.id) ? { ...c, effect: batchEffect } : c
    );
    setNarrationClips(updated);
  };

  // 영상 생성 실행
  const handleGenerateVideos = async () => {
    const toGenerate = visibleClips.filter(
      (c) => checkedIds.has(c.id) && c.imageUrl
    );

    if (toGenerate.length === 0) return;

    for (const clip of toGenerate) {
      if (!canAfford('video')) {
        showToast('크레딧이 부족합니다! 영상 생성을 중단합니다.', 'warning');
        break;
      }

      setGeneratingIds((prev) => new Set(prev).add(clip.id));

      try {
        if (!spend('video')) break;

        const videoPrompt = buildVideoPrompt({
          artStyleId: artStyleId ?? 'cinematic',
          sceneText: clip.text,
          seedCards: [],
          templateId: templateId ?? undefined,
        });

        const result = await generateVideo({
          imageUrl: clip.imageUrl,
          prompt:   videoPrompt,
          duration: Math.min(6, Math.ceil(clip.duration)),
          sceneId:  clip.sceneId,
          model:    aiModelPreferences.video,
        });

        const updated = narrationClips.map((c) =>
          c.id === clip.id
            ? { ...c, videoUrl: result.videoUrl, isVideoEnabled: true }
            : c
        );
        setNarrationClips(updated);

        // sceneVideos store에도 기록 (상태 라벨 동기화)
        const { setSceneVideos, sceneVideos: currentSV } = useProjectStore.getState();
        const existing = currentSV[clip.sceneId] || [];
        setSceneVideos({
          ...currentSV,
          [clip.sceneId]: [...existing, result.videoUrl],
        });
      } catch (err) {
        console.error(`[NarrationVideo] ${clip.id} 영상화 실패:`, err);
      } finally {
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(clip.id);
          return next;
        });
      }
    }
  };

  // 클립별 상태 텍스트 (sceneVideos store도 확인하여 완료 상태 유지)
  const getStatusLabel = (clip: NarrationClip): string => {
    if (generatingIds.has(clip.id)) return '생성 중...';
    const hasVideo = (clip.videoUrl && clip.isVideoEnabled)
        || (sceneVideos[clip.sceneId]?.length > 0);
    if (hasVideo) return '완료';
    return '대기 중';
  };

  const content = (
    <div className="narration-video-step">
      {/* 헤더 */}
      <div className="narration-video-step__header">
        <h2 className="narration-video-step__title">
          Step 6: 영상화
          <span className="narration-video-step__beta-badge">Beta</span>
        </h2>

        {/* 모델 선택 */}
        <div className="narration-video-step__model-select">
          <label className="narration-video-step__model-label" htmlFor="video-model-select">
            AI 영상 모델
          </label>
          <select
            id="video-model-select"
            className="narration-video-step__model-dropdown"
            value={aiModelPreferences.video}
            onChange={(e) => setAiModelPreference('video', e.target.value)}
            disabled={isGenerating}
          >
            {videoModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 클립 목록 */}
      {visibleClips.length === 0 ? (
        <div className="narration-video-step__empty">
          이미지가 생성된 씬이 없습니다. 이전 단계에서 이미지를 먼저 생성해 주세요.
        </div>
      ) : (
        <>
          {/* 전체 선택 행 */}
          <div className="narration-video-step__select-all-row">
            <label className="narration-video-step__clip-checkbox">
              <input
                type="checkbox"
                checked={checkedIds.size === visibleClips.length && visibleClips.length > 0}
                onChange={handleToggleAll}
                disabled={isGenerating}
              />
              <span>전체 선택 ({visibleClips.length}개)</span>
            </label>
          </div>

          {/* 일괄 Ken Burns 효과 적용 */}
          {kenBurnsCount > 0 && (
            <div className="narration-video-step__batch-ken-burns">
              <span className="narration-video-step__batch-label">
                미체크 {kenBurnsCount}개 일괄 효과:
              </span>
              <select
                className="narration-video-step__ken-burns-select"
                value={batchEffect}
                onChange={(e) => setBatchEffect(e.target.value as NarrationClip['effect'])}
                disabled={isGenerating}
              >
                {KEN_BURNS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                className="narration-video-step__batch-apply-btn"
                onClick={handleBatchEffectApply}
                disabled={isGenerating}
              >
                일괄 적용
              </button>
            </div>
          )}

          {/* 클립 목록 */}
          <ul className="narration-video-step__clip-list">
            {visibleClips.map((clip, clipIdx) => {
              const isChecked    = checkedIds.has(clip.id);
              const isThisGen    = generatingIds.has(clip.id);
              const isDone       = !isThisGen && Boolean(clip.videoUrl) && clip.isVideoEnabled;
              const statusLabel  = getStatusLabel(clip);

              return (
                <li
                  key={clip.id}
                  className={[
                    'narration-video-step__clip-row',
                    isChecked    ? 'narration-video-step__clip-row--checked'     : '',
                    isThisGen    ? 'narration-video-step__clip-row--generating'  : '',
                    isDone       ? 'narration-video-step__clip-row--done'        : '',
                  ].filter(Boolean).join(' ')}
                >
                  {/* 체크박스 (Shift+클릭 범위 선택 지원) */}
                  <label
                    className="narration-video-step__clip-checkbox"
                    onMouseDown={(e) => { shiftKeyRef.current = e.shiftKey; }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (!isGenerating) {
                          handleToggleCheck(clip.id, clipIdx, shiftKeyRef.current || undefined);
                          shiftKeyRef.current = false;
                        }
                      }}
                      disabled={isGenerating}
                    />
                  </label>

                  {/* 썸네일 */}
                  <div className="narration-video-step__clip-thumbnail">
                    <img
                      src={clip.imageUrl}
                      alt={`씬 ${clip.sceneId} 썸네일`}
                    />
                    {isDone && (
                      <span className="narration-video-step__done-badge">영상 완료</span>
                    )}
                  </div>

                  {/* 대본 텍스트 */}
                  <p className="narration-video-step__clip-text">
                    {clip.text.length > 80 ? clip.text.slice(0, 80) + '...' : clip.text}
                  </p>

                  {/* 상태 / Ken Burns */}
                  <div className="narration-video-step__clip-status">
                    {isChecked ? (
                      <span
                        className={[
                          'narration-video-step__status-badge',
                          isThisGen ? 'narration-video-step__status-badge--generating' : '',
                          isDone    ? 'narration-video-step__status-badge--done'       : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {statusLabel}
                      </span>
                    ) : (
                      <div className="narration-video-step__ken-burns">
                        <label
                          className="narration-video-step__ken-burns-label"
                          htmlFor={`effect-${clip.id}`}
                        >
                          Ken Burns
                        </label>
                        <select
                          id={`effect-${clip.id}`}
                          className="narration-video-step__ken-burns-select"
                          value={clip.effect}
                          onChange={(e) =>
                            handleEffectChange(clip.id, e.target.value as NarrationClip['effect'])
                          }
                          disabled={isGenerating}
                        >
                          {KEN_BURNS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 요약 정보 */}
          <div className="narration-video-step__summary">
            <span>
              영상화: {checkedCount}개
              {checkedCount > 0 && ` (약 ${estimatedCost} 크레딧)`}
            </span>
            <span className="narration-video-step__summary-divider">|</span>
            <span>Ken Burns: {kenBurnsCount}개</span>
          </div>
        </>
      )}

      {/* 액션 버튼 */}
      <div className="narration-video-step__actions">
        {onPrev && (
          <button
            className="btn-secondary"
            onClick={onPrev}
            disabled={isGenerating}
          >
            이전
          </button>
        )}

        <button
          className="narration-video-step__btn-generate"
          onClick={handleGenerateVideos}
          disabled={checkedCount === 0 || isGenerating}
        >
          {isGenerating ? '영상화 진행 중...' : `선택된 씬 영상화 (${checkedCount}개)`}
        </button>

        <button
          className="narration-video-step__btn-next"
          onClick={onNext}
          disabled={isGenerating}
        >
          다음: 편집 &rarr;
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="narration-video-modal" onClick={(e) => e.stopPropagation()}>
          <button className="narration-video-modal__close" onClick={onClose}><X size={16} /></button>
          {content}
        </div>
      </div>
    );
  }

  return content;
}

export default NarrationVideoStep;
