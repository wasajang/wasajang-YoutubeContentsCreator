/**
 * GeneratePage — 시네마틱 3단계: 씨드 매칭 + 이미지/영상 생성
 *
 * StoryboardPage에서 카드 선택 + 컷 분할 후,
 * 이 페이지에서 프롬프트 편집 → 이미지 생성 → 영상 생성을 수행합니다.
 * (나레이션 모드에서는 사용하지 않음 — StoryboardPage 내에서 처리)
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import CreditShortageModal from '../components/CreditShortageModal';
import { SeedCheckPhase } from '../components/storyboard';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../store/projectStore';
import { useCredits } from '../hooks/useCredits';
import { useDeck, EXTRA_CARD_CREDIT } from '../hooks/useDeck';
import { useGeneration } from '../hooks/useGeneration';
import { getSceneGradient } from '../utils/scene-gradient';
import { generateScenePrompts } from '../services/ai-llm';
import { getArtStylePromptPrefix } from '../data/artStyles';
import { useToastStore } from '../hooks/useToast';

const GeneratePage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title,
        artStyleId, scenes: storeScenes, cardLibrary, addToCardLibrary,
        aiModelPreferences, setAiModelPreference,
        templateId, aspectRatio,
    } = useProjectStore();
    const { remaining: creditsRemaining, canAfford, spend, CREDIT_COSTS } = useCredits();

    const [selectedScene, setSelectedScene] = useState<string | null>(null);

    // 크레딧 부족 모달 상태
    const [creditModal, setCreditModal] = useState<{ open: boolean; required: number; label: string }>({
        open: false, required: 0, label: '',
    });

    const scenes = (storeScenes as Scene[]).filter(s => s.checked !== false);

    // ── 훅 ──
    const deckApi = useDeck({ cardLibrary, addToCardLibrary, canAfford, spend, creditsRemaining, CREDIT_COSTS });
    const genApi = useGeneration({
        scenes, deck: deckApi.deck, artStyleId,
        canAfford, spend, creditsRemaining, CREDIT_COSTS,
        imageModel: aiModelPreferences.image,
        videoModel: aiModelPreferences.video,
        templateId: templateId ?? undefined,
        aspectRatio: aspectRatio,
        onCreditShortage: (required, label) => {
            setCreditModal({ open: true, required, label });
        },
    });

    // ── AI 프롬프트 작성 ──
    const [isAiPromptGenerating, setIsAiPromptGenerating] = useState(false);
    const aiPromptCreditCost = CREDIT_COSTS.promptAi || 2;

    const handleAiPromptGenerate = useCallback(async () => {
        // 크레딧 확인
        if (!canAfford('promptAi')) {
            setCreditModal({ open: true, required: aiPromptCreditCost, label: 'AI 프롬프트 작성' });
            return;
        }

        // 크레딧 차감
        if (!spend('promptAi')) return;

        // 1. 로딩 상태 먼저 표시
        setIsAiPromptGenerating(true);

        try {
            // 2. 씨드카드 매칭 (initPrompts로 seeds 할당 — 프롬프트도 임시 생성됨)
            genApi.initPrompts();

            // 3. 씬별 씨드카드 정보 수집 (initPrompts에서 할당된 seeds 사용)
            const seedCardsMap: Record<string, Array<{ name: string; type: string; description: string }>> = {};
            scenes.forEach((scene) => {
                const seedIds = genApi.sceneSeeds[scene.id] || [];
                seedCardsMap[scene.id] = seedIds
                    .map((id) => deckApi.deck.find((c) => c.id === id))
                    .filter((c): c is NonNullable<typeof c> => !!c)
                    .map((c) => ({ name: c.name, type: c.type, description: c.description || '' }));
            });

            // 4. AI로 고품질 프롬프트 작성
            const result = await generateScenePrompts({
                scenes: scenes.map((s) => ({ id: s.id, text: s.text })),
                seedCards: seedCardsMap,
                artStyleId,
                artStylePrefix: getArtStylePromptPrefix(artStyleId),
                templateId: templateId ?? undefined,
            });

            // 5. AI 결과로 프롬프트 교체
            if (result.prompts && Object.keys(result.prompts).length > 0) {
                Object.entries(result.prompts).forEach(([sceneId, prompt]) => {
                    if (prompt.image) genApi.updatePrompt(sceneId, 'image', prompt.image);
                    if (prompt.video) genApi.updatePrompt(sceneId, 'video', prompt.video);
                });
                useToastStore.getState().addToast(
                    `AI 프롬프트 작성 완료! (${Object.keys(result.prompts).length}개 씬, ${Math.round(result.durationMs / 1000)}초)`,
                    'success'
                );
            } else {
                // AI가 빈 결과 → 자동 생성 프롬프트 유지
                useToastStore.getState().addToast(
                    'AI 프롬프트를 생성하지 못했습니다 (쿼터 초과 또는 Mock 모드). 자동 생성된 프롬프트를 사용합니다.',
                    'warning'
                );
            }
        } catch (err) {
            // AI 실패 시 자동 프롬프트로 폴백
            console.error('[AI Prompt] 에러:', err);
            genApi.initPrompts();  // 폴백: 자동 조립
            useToastStore.getState().addToast(
                `AI 프롬프트 작성 실패: ${err instanceof Error ? err.message : '알 수 없는 에러'}. 자동 생성 프롬프트로 대체합니다.`,
                'error'
            );
        } finally {
            setIsAiPromptGenerating(false);
        }
    }, [scenes, deckApi.deck, artStyleId, templateId, canAfford, spend, genApi, aiPromptCreditCost]);

    // ── WorkflowSteps 클릭 ──
    const handleMainClick = (step: number) => {
        switch (step) {
            case 1: navigate('/project/idea'); break;
            case 2: navigate('/project/storyboard'); break;
            case 3: break; // 현재 페이지
            case 4: navigate('/project/timeline'); break;
        }
    };

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 헤더 */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">{title || 'Untitled Project'}</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps
                        currentMain={3}
                        currentSub="seed-match"
                        onMainClick={handleMainClick}
                    />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn" disabled title="Animate 단계에서 이용 가능">Export</button>
                    <button className="btn-icon"><HelpCircle size={16} /></button>
                </div>
            </div>

            {/* 씬이 없는 경우 안내 */}
            {scenes.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1rem' }}>아직 대본이 없습니다. 아이디어 페이지에서 대본을 먼저 작성해주세요.</p>
                    <button className="btn-primary" onClick={() => navigate('/project/idea')}>
                        아이디어 페이지로 이동
                    </button>
                </div>
            )}

            {/* 시드 매칭 & 이미지/영상 생성 */}
            {scenes.length > 0 && (
                <SeedCheckPhase
                    scenes={scenes}
                    deck={deckApi.deck}
                    artStyleId={artStyleId}
                    selectedScene={selectedScene}
                    setSelectedScene={setSelectedScene}
                    genApi={genApi}
                    deckApi={deckApi}
                    getSceneGradient={getSceneGradient}
                    onPrevPhase={() => navigate('/project/storyboard')}
                    onNavigateToTimeline={() => navigate('/project/timeline')}
                    imageModel={aiModelPreferences.image}
                    videoModel={aiModelPreferences.video}
                    onImageModelChange={(id) => setAiModelPreference('image', id)}
                    onVideoModelChange={(id) => setAiModelPreference('video', id)}
                    aspectRatio={aspectRatio}
                    onAiPromptGenerate={handleAiPromptGenerate}
                    isAiPromptGenerating={isAiPromptGenerating}
                    aiPromptCreditCost={aiPromptCreditCost}
                />
            )}

            {/* 크레딧 부족 모달 */}
            <CreditShortageModal
                isOpen={creditModal.open}
                onClose={() => setCreditModal({ open: false, required: 0, label: '' })}
                requiredCredits={creditModal.required}
                currentCredits={creditsRemaining}
                actionLabel={creditModal.label}
            />

            {/* 카드 추가 크레딧 확인 다이얼로그 */}
            {deckApi.creditConfirmCard && (
                <div className="modal-overlay" onClick={deckApi.cancelCreditAdd}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, padding: 24 }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>카드 추가 확인</h3>
                        <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)' }}>
                            <strong>"{deckApi.creditConfirmCard.name}"</strong> 카드를 덱에 추가하시겠습니까?
                        </p>
                        <p style={{ margin: '0 0 16px', color: 'var(--color-warning)', fontSize: '0.9rem' }}>
                            무료 한도(5장)를 초과하여 크레딧 {EXTRA_CARD_CREDIT}개가 차감됩니다.
                            <br />카드를 제거하면 크레딧이 환불됩니다.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn-ghost" onClick={deckApi.cancelCreditAdd}>취소</button>
                            <button className="btn-primary" onClick={deckApi.confirmCreditAdd}>
                                확인 ({EXTRA_CARD_CREDIT}크레딧 차감)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeneratePage;
