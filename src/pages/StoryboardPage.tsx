import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import WorkflowSteps, { narrationStepToGroup, narrationStepToSubKey } from '../components/WorkflowSteps';
import CreditShortageModal from '../components/CreditShortageModal';
import { CastSetupPhase, CutSplitPhase, SeedCheckPhase } from '../components/storyboard';
import NarrationVideoStep from '../components/narration/NarrationVideoStep';
import { useProjectStore } from '../store/projectStore';
import type { Scene, AssetCard } from '../store/projectStore';
import { aiSuggestedCards } from '../data/mockData';
import { getTemplateById } from '../data/templates';
import { useCredits } from '../hooks/useCredits';
import { useDeck, DEFAULT_DECK_SIZE as DEFAULT_DECK_SIZE_CONST, EXTRA_CARD_CREDIT } from '../hooks/useDeck';
import { useGeneration } from '../hooks/useGeneration';
import { syncScenesImageToClips } from '../utils/narration-sync';
import { getSceneGradient } from '../utils/scene-gradient';
import { analyzeScript, generateScenePrompts } from '../services/ai-llm';
import { getArtStylePromptPrefix } from '../data/artStyles';
import { useToastStore } from '../hooks/useToast';

type StoryboardPhase = 'script-review' | 'cast-setup' | 'seed-check' | 'generating-video' | 'complete';

const StoryboardPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title,
        artStyleId, scenes: storeScenes, cardLibrary, addToCardLibrary,
        aiModelPreferences, setAiModelPreference, mode,
        narrationStep, setNarrationStep, narrationClips, setNarrationClips,
        templateId, aspectRatio, selectedDeck,
    } = useProjectStore();
    const { remaining: creditsRemaining, canAfford, spend, CREDIT_COSTS } = useCredits();

    const [phase, setPhase] = useState<StoryboardPhase>(() => {
        // 이미 이미지가 생성된 씬이 있으면 seed-check로 복원
        if (mode === 'narration' && narrationStep >= 5) return 'seed-check';
        return 'cast-setup';
    });
    const [selectedScene, setSelectedScene] = useState<string | null>(null);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(selectedDeck.length === 0);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    // 크레딧 부족 모달 상태
    const [creditModal, setCreditModal] = useState<{ open: boolean; required: number; label: string }>({
        open: false, required: 0, label: '',
    });

    // 씬이 없으면 안내 화면 표시 (목업 폴백 제거)
    const allScenes = storeScenes as Scene[];
    // 나레이션 모드: 모든 씬 포함 (TimelinePage에서 checked:false로 생성되므로)
    const scenes = mode === 'narration' ? allScenes : allScenes.filter(s => s.checked !== false);
    const scriptCuts = storeScenes.map((s) => s.text);

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

    // ── AI 분석 핸들러 (deckApi + genApi 양쪽 조율) ──
    const handleAiAnalysis = async (doAnalysis: boolean) => {
        const template = templateId ? getTemplateById(templateId) : null;
        const castPreset = template?.castPreset;

        if (!doAnalysis) {
            // "기본 카드 사용" — 템플릿 프리셋 카드 또는 기본 제안 카드
            if (castPreset) {
                const presetCards: AssetCard[] = [
                    ...castPreset.characters.map((c, i) => ({
                        id: `preset-char-${i}`,
                        name: c.name,
                        type: 'character' as const,
                        description: c.description,
                        imageUrl: c.referenceImageUrl || '',
                        seed: Math.floor(Math.random() * 99999),
                        status: 'pending' as const,
                        isRequired: c.isRequired,
                        source: 'template' as const,
                    })),
                    ...castPreset.backgrounds.map((c, i) => ({
                        id: `preset-bg-${i}`,
                        name: c.name,
                        type: 'background' as const,
                        description: c.description,
                        imageUrl: c.referenceImageUrl || '',
                        seed: Math.floor(Math.random() * 99999),
                        status: 'pending' as const,
                        isRequired: c.isRequired,
                        source: 'template' as const,
                    })),
                    ...castPreset.items.map((c, i) => ({
                        id: `preset-item-${i}`,
                        name: c.name,
                        type: 'item' as const,
                        description: c.description,
                        imageUrl: c.referenceImageUrl || '',
                        seed: Math.floor(Math.random() * 99999),
                        status: 'pending' as const,
                        isRequired: c.isRequired,
                        source: 'template' as const,
                    })),
                ];
                presetCards.forEach((c) => addToCardLibrary(c));
                deckApi.setDeck(presetCards);
            } else {
                // 템플릿 없으면 기존 aiSuggestedCards 폴백
                const defaultDeck = aiSuggestedCards.slice(0, 5).map((c) => ({ ...c, source: 'ai' as const }));
                defaultDeck.forEach((c) => addToCardLibrary(c));
                deckApi.setDeck(defaultDeck);
            }
            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                scenes.forEach((s) => { updated[s.id] = []; });
                return updated;
            });
            setShowAiAnalysisModal(false);
            return;
        }

        // ── 실제 AI 분석 시작 ──
        setIsAiAnalyzing(true);

        try {
            const fullScript = scenes.map((s) => s.text).join('\n\n');
            const result = await analyzeScript({
                fullScript,
                scenes: scenes.map((s) => ({ id: s.id, text: s.text })),
                existingCards: cardLibrary.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    description: c.description,
                })),
                templateId: templateId || undefined,
            });

            // 분석 결과 → AssetCard 변환
            const analysisCards: AssetCard[] = result.recommendedCards.map((rec, i) => {
                if (rec.matchedCardId) {
                    // 기존 카드 매칭됨 → 기존 카드 재사용
                    const existing = cardLibrary.find((c) => c.id === rec.matchedCardId);
                    if (existing) {
                        return { ...existing, isRequired: true, source: 'ai' as const };
                    }
                }
                // 신규 카드 생성
                return {
                    id: rec.matchedCardId || `ai-new-${i}`,
                    name: rec.name,
                    type: rec.type,
                    description: rec.description,
                    imageUrl: '',
                    seed: Math.floor(Math.random() * 99999),
                    status: 'pending' as const,
                    isRequired: true,
                    source: 'ai' as const,
                };
            });

            // 덱 설정: 5장까지만 자동 추가, 나머지는 라이브러리에만
            analysisCards.forEach((c) => addToCardLibrary(c));
            deckApi.setDeck(analysisCards.slice(0, DEFAULT_DECK_SIZE_CONST));

            // 씬별 매칭 결과 → sceneSeeds에 저장
            // "ai-new-N" ID를 실제 카드 ID로 매핑
            const idMapping: Record<string, string> = {};
            result.recommendedCards.forEach((rec, i) => {
                const cardId = rec.matchedCardId || `ai-new-${i}`;
                idMapping[`ai-new-${i}`] = cardId;
                if (rec.matchedCardId) idMapping[rec.matchedCardId] = rec.matchedCardId;
            });

            const resolvedSeeds: Record<string, string[]> = {};
            Object.entries(result.sceneMatching).forEach(([sceneId, cardIds]) => {
                resolvedSeeds[sceneId] = cardIds.map((id) => idMapping[id] || id);
            });

            genApi.setSceneSeeds((prev) => ({ ...prev, ...resolvedSeeds }));

            console.log('[AI Analysis] 카드 추천 + 씬 매칭 완료:', {
                cards: analysisCards.length,
                scenes: Object.keys(resolvedSeeds).length,
                provider: result.provider,
                time: `${result.durationMs}ms`,
            });
        } catch (err) {
            console.error('[AI Analysis] 에러:', err);
            // 에러 시 기본 카드로 폴백 (UX 끊김 없음)
            const fallbackCards = aiSuggestedCards.slice(0, 5).map((c) => ({
                ...c, source: 'ai' as const,
            }));
            fallbackCards.forEach((c) => addToCardLibrary(c));
            deckApi.setDeck(fallbackCards);

            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                scenes.forEach((s) => { updated[s.id] = []; });
                return updated;
            });
        } finally {
            setIsAiAnalyzing(false);
            setShowAiAnalysisModal(false);
        }
    };

    // ── 씬 그라디언트 (공통 유틸) ──
    // getSceneGradient → src/utils/scene-gradient.ts 로 분리됨

    // ── WorkflowSteps 매핑 (시네마틱) — StoryboardPage = 항상 2단계 ──
    const phaseToSub: Record<StoryboardPhase, string> = {
        'cast-setup': 'cast-setup',
        'script-review': 'cut-split',
        'seed-check': 'cast-setup',
        'generating-video': 'cast-setup',
        'complete': 'cast-setup',
    };

    // 시네마틱 모드 메인 스텝 클릭
    const handleMainClick = (step: number) => {
        switch (step) {
            case 1: navigate('/project/idea'); break;
            case 2: break; // 현재 페이지
            case 3: navigate('/project/generate'); break;
            case 4: navigate('/project/timeline'); break;
        }
    };

    // 나레이션 모드 그룹 클릭 (4그룹 체계)
    const handleNarrationMainClick = (group: number) => {
        const groupFirstStep: Record<number, number> = { 1: 1, 2: 4, 3: 6, 4: 8 };
        const groupRoute: Record<number, string> = {
            1: '/project/idea',
            2: '/project/storyboard',
            3: '/project/timeline',
            4: '/project/timeline',
        };
        const step = groupFirstStep[group] || 1;
        setNarrationStep(step);
        const route = groupRoute[group];
        if (route && route !== '/project/storyboard') {
            navigate(route);
        } else {
            // 그룹 2 = 스토리보드 — 첫 서브스텝(cast-setup)으로
            setPhase('cast-setup');
        }
    };

    // 나레이션 모드 서브스텝 클릭
    const handleNarrationSubClick = (subKey: string) => {
        const subKeyToStep: Record<string, number> = {
            'script': 1, 'voice': 2, 'split': 3,
            'cast-setup': 4, 'image-gen': 5,
            'video': 6, 'edit': 7, 'export': 8,
        };
        const step = subKeyToStep[subKey];
        if (!step) return;
        setNarrationStep(step);
        if (step <= 1) { navigate('/project/idea'); return; }
        if (step <= 3 || step >= 7) { navigate('/project/timeline'); return; }
        // step 4-5: stay on storyboard
        if (step === 4) setPhase('cast-setup');
        if (step === 5) setPhase('seed-check');
        // step 6: 영상화 모달
        if (step === 6) { setPhase('seed-check'); setShowVideoModal(true); return; }
    };

    // ── AI 프롬프트 작성 ──
    const [isAiPromptGenerating, setIsAiPromptGenerating] = useState(false);
    const aiPromptCreditCost = CREDIT_COSTS.promptAi || 2;

    const handleAiPromptGenerate = async () => {
        if (!canAfford('promptAi')) {
            setCreditModal({ open: true, required: aiPromptCreditCost, label: 'AI 프롬프트 작성' });
            return;
        }
        if (!spend('promptAi')) return;

        // 1. 로딩 상태 먼저
        setIsAiPromptGenerating(true);

        try {
            // 2. 씨드 매칭 (+ 임시 자동 프롬프트)
            genApi.initPrompts();

            // 3. 씬별 씨드카드 정보 수집
            const seedCardsMap: Record<string, Array<{ name: string; type: string; description: string }>> = {};
            scenes.forEach((scene) => {
                const seedIds = genApi.sceneSeeds[scene.id] || [];
                seedCardsMap[scene.id] = seedIds
                    .map((id) => deckApi.deck.find((c) => c.id === id))
                    .filter((c): c is NonNullable<typeof c> => !!c)
                    .map((c) => ({ name: c.name, type: c.type, description: c.description || '' }));
            });

            // 4. AI 프롬프트 작성
            const result = await generateScenePrompts({
                scenes: scenes.map((s) => ({ id: s.id, text: s.text })),
                seedCards: seedCardsMap,
                artStyleId,
                artStylePrefix: getArtStylePromptPrefix(artStyleId),
                templateId: templateId ?? undefined,
            });

            // 5. AI 결과로 교체
            if (result.prompts && Object.keys(result.prompts).length > 0) {
                Object.entries(result.prompts).forEach(([sceneId, prompt]) => {
                    if (prompt.image) genApi.updatePrompt(sceneId, 'image', prompt.image);
                    if (prompt.video) genApi.updatePrompt(sceneId, 'video', prompt.video);
                });
                useToastStore.getState().addToast(
                    `AI 프롬프트 작성 완료! (${Object.keys(result.prompts).length}개 씬, ${Math.round(result.durationMs / 1000)}초)`, 'success'
                );
            } else {
                useToastStore.getState().addToast(
                    'AI 프롬프트를 생성하지 못했습니다 (쿼터 초과 또는 Mock 모드). 자동 생성 프롬프트를 사용합니다.', 'warning'
                );
            }
        } catch (err) {
            console.error('[AI Prompt] 에러:', err);
            genApi.initPrompts();
            useToastStore.getState().addToast(
                `AI 프롬프트 작성 실패: ${err instanceof Error ? err.message : '알 수 없는 에러'}. 자동 생성으로 대체합니다.`, 'error'
            );
        } finally {
            setIsAiPromptGenerating(false);
        }
    };

    // 나레이션 Step 5(seed-check) 완료 후 Step 6 모달 표시
    const handleGoToVideo = () => {
        const synced = syncScenesImageToClips(
            scenes.map((s) => ({ id: s.id, imageUrl: s.imageUrl || '' })),
            narrationClips,
        );
        setNarrationClips(synced);
        setNarrationStep(6);
        setShowVideoModal(true);
    };

    // ── 나레이션 모드 분기 ──
    if (mode === 'narration') {
        return (
            <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 헤더 */}
                <div className="storyboard-header">
                    <h2 className="storyboard-header__title">{title || 'Untitled Project'}</h2>
                    <div className="storyboard-header__center">
                        <WorkflowSteps
                            currentMain={narrationStepToGroup(narrationStep)}
                            currentSub={narrationStepToSubKey(narrationStep)}
                            onMainClick={handleNarrationMainClick}
                            onSubClick={handleNarrationSubClick}
                        />
                    </div>
                    <div className="storyboard-header__right">
                        <button className="export-btn" disabled title="Edit 단계에서 이용 가능">Export</button>
                        <button className="btn-icon"><HelpCircle size={16} /></button>
                    </div>
                </div>

                {/* Step 4: Direct — 카드 선택 */}
                {phase === 'cast-setup' && (
                    <CastSetupPhase
                        deckApi={deckApi}
                        showAiAnalysisModal={showAiAnalysisModal}
                        isAiAnalyzing={isAiAnalyzing}
                        onAiAnalysis={handleAiAnalysis}
                        templateId={templateId}
                        templateName={templateId ? getTemplateById(templateId)?.name : undefined}
                        castPreset={templateId ? getTemplateById(templateId)?.castPreset : undefined}
                        onNextPhase={() => {
                            // 나레이션 모드: CutSplit 스킵 → 바로 시드 매칭
                            setPhase('seed-check');
                            setNarrationStep(5);
                        }}
                        onPrevPhase={() => {
                            // Step 4 이전: Step 3(Split, TimelinePage)으로
                            setNarrationStep(3);
                            navigate('/project/timeline');
                        }}
                    />
                )}

                {/* Step 5: Image — 시드 매칭 & 이미지 생성 */}
                {phase === 'seed-check' && (
                    <SeedCheckPhase
                        scenes={scenes}
                        deck={deckApi.deck}
                        artStyleId={artStyleId}
                        selectedScene={selectedScene}
                        setSelectedScene={setSelectedScene}
                        genApi={genApi}
                        deckApi={deckApi}
                        getSceneGradient={getSceneGradient}
                        onPrevPhase={() => {
                            // Step 5 이전: Step 4(cast-setup)으로
                            setPhase('cast-setup');
                            setNarrationStep(4);
                        }}
                        onNavigateToTimeline={handleGoToVideo}
                        imageModel={aiModelPreferences.image}
                        videoModel={aiModelPreferences.video}
                        onImageModelChange={(id) => setAiModelPreference('image', id)}
                        onVideoModelChange={(id) => setAiModelPreference('video', id)}
                        nextLabel="다음: 영상화"
                        aspectRatio={aspectRatio}
                        onAiPromptGenerate={handleAiPromptGenerate}
                        isAiPromptGenerating={isAiPromptGenerating}
                        aiPromptCreditCost={aiPromptCreditCost}
                    />
                )}

                {/* 영상화 모달 (Step 6) */}
                {showVideoModal && (
                    <NarrationVideoStep
                        isModal
                        onNext={() => {
                            setShowVideoModal(false);
                            setNarrationStep(7);
                            navigate('/project/timeline');
                        }}
                        onClose={() => setShowVideoModal(false)}
                        onPrev={() => {
                            setShowVideoModal(false);
                            setNarrationStep(5);
                        }}
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
            </div>
        );
    }

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 헤더 */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">{title || 'Untitled Project'}</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps
                        currentMain={2}
                        currentSub={phaseToSub[phase]}
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

            {/* ── Phase: 카드 선택 ── */}
            {scenes.length > 0 && phase === 'cast-setup' && (
                <CastSetupPhase
                    deckApi={deckApi}
                    showAiAnalysisModal={showAiAnalysisModal}
                    isAiAnalyzing={isAiAnalyzing}
                    onAiAnalysis={handleAiAnalysis}
                    templateId={templateId}
                    templateName={templateId ? getTemplateById(templateId)?.name : undefined}
                    castPreset={templateId ? getTemplateById(templateId)?.castPreset : undefined}
                    onNextPhase={() => {
                        // 시네마틱 모드: script-review → seed-check 순서
                        setPhase('script-review');
                    }}
                />
            )}

            {/* ── Phase: 컷 분할 ── */}
            {scenes.length > 0 && phase === 'script-review' && (
                <CutSplitPhase
                    scriptCuts={scriptCuts}
                    scenes={scenes}
                    videoCountPerScene={genApi.videoCountPerScene}
                    setVideoCountPerScene={genApi.setVideoCountPerScene}
                    deckApi={deckApi}
                    onPrevPhase={() => setPhase('cast-setup')}
                    onNextPhase={() => navigate('/project/generate')}
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

export default StoryboardPage;
