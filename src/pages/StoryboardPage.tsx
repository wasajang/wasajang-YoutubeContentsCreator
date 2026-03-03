import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import WorkflowSteps, { narrationStepToGroup, narrationStepToSubKey } from '../components/WorkflowSteps';
import CreditShortageModal from '../components/CreditShortageModal';
import { CastSetupPhase, CutSplitPhase, SeedCheckPhase } from '../components/storyboard';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../store/projectStore';
import { aiSuggestedCards } from '../data/mockData';
import { getTemplateById } from '../data/templates';
import { useCredits } from '../hooks/useCredits';
import { useDeck } from '../hooks/useDeck';
import { useGeneration } from '../hooks/useGeneration';
import { syncScenesImageToClips } from '../utils/narration-sync';

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
    const handleAiAnalysis = (doAnalysis: boolean) => {
        const template = templateId ? getTemplateById(templateId) : null;
        const castPreset = template?.castPreset;
        const castConfig = castPreset
            ? { characters: castPreset.characters.length, backgrounds: castPreset.backgrounds.length, items: castPreset.items.length }
            : { characters: 3, backgrounds: 1, items: 1 };
        const totalSlots = castConfig.characters + castConfig.backgrounds + castConfig.items;

        if (!doAnalysis) {
            const defaultDeck = aiSuggestedCards.slice(0, totalSlots).map((c) => ({ ...c, source: 'ai' as const }));
            deckApi.setDeck(defaultDeck);
            defaultDeck.forEach((c) => addToCardLibrary(c));
            // 씨드 배정은 여기서 하지 않음 — "AI 분석 및 프롬프트 작성" 단계에서 수행
            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                scenes.forEach((s) => { updated[s.id] = []; });
                return updated;
            });
            setShowAiAnalysisModal(false);
            return;
        }
        setIsAiAnalyzing(true);
        setTimeout(() => {
            const libChars = cardLibrary.filter((c) => c.type === 'character');
            const libBgs = cardLibrary.filter((c) => c.type === 'background');
            const libItems = cardLibrary.filter((c) => c.type === 'item');

            const selectedChars = libChars.slice(0, castConfig.characters).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedBgs = libBgs.slice(0, castConfig.backgrounds).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedItems = libItems.slice(0, castConfig.items).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));

            const aiCharsPool = aiSuggestedCards.filter((c) => c.type === 'character');
            const aiBgsPool = aiSuggestedCards.filter((c) => c.type === 'background');
            const aiItemsPool = aiSuggestedCards.filter((c) => c.type === 'item');

            while (selectedChars.length < castConfig.characters && aiCharsPool.length > 0) {
                const next = aiCharsPool.shift()!;
                if (!selectedChars.some((c) => c.id === next.id)) selectedChars.push({ ...next, source: 'ai', isRequired: true });
            }
            while (selectedBgs.length < castConfig.backgrounds && aiBgsPool.length > 0) {
                const next = aiBgsPool.shift()!;
                if (!selectedBgs.some((c) => c.id === next.id)) selectedBgs.push({ ...next, source: 'ai', isRequired: true });
            }
            while (selectedItems.length < castConfig.items && aiItemsPool.length > 0) {
                const next = aiItemsPool.shift()!;
                if (!selectedItems.some((c) => c.id === next.id)) selectedItems.push({ ...next, source: 'ai', isRequired: true });
            }

            const finalDeck = [...selectedChars, ...selectedBgs, ...selectedItems];
            finalDeck.forEach((c) => addToCardLibrary(c));
            deckApi.setDeck(finalDeck);

            // 씨드 배정은 여기서 하지 않음 — "AI 분석 및 프롬프트 작성" 단계에서 수행
            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                scenes.forEach((s) => { updated[s.id] = []; });
                return updated;
            });
            setIsAiAnalyzing(false);
            setShowAiAnalysisModal(false);
        }, 2500);
    };

    // ── 씬 그라디언트 ──
    const getSceneGradient = (i: number) => {
        const g = [
            'linear-gradient(135deg,#1a0533,#2d1b3d,#0f2027)',
            'linear-gradient(135deg,#0f2027,#1a1a2e,#2d1b3d)',
            'linear-gradient(135deg,#3a2518,#1a0f0a,#2d1b3d)',
            'linear-gradient(135deg,#1e2a3a,#0a1520,#1a0533)',
            'linear-gradient(135deg,#2d1b3d,#3a2518,#0f2027)',
            'linear-gradient(135deg,#1a1a2e,#0f2027,#3a2518)',
        ];
        return g[i % g.length];
    };

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
        if (step <= 3 || step >= 6) { navigate('/project/timeline'); return; }
        // step 4-5: stay on storyboard
        if (step === 4) setPhase('cast-setup');
        if (step === 5) setPhase('seed-check');
    };

    // 나레이션 Step 5(seed-check) 완료 후 Step 6으로 이동
    const handleGoToVideo = () => {
        const synced = syncScenesImageToClips(
            scenes.map((s) => ({ id: s.id, imageUrl: s.imageUrl || '' })),
            narrationClips,
        );
        setNarrationClips(synced);
        setNarrationStep(6);
        navigate('/project/timeline');
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
        </div>
    );
};

export default StoryboardPage;
