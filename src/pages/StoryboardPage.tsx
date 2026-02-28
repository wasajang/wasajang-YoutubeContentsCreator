import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { CastSetupPhase, CutSplitPhase, SeedCheckPhase } from '../components/storyboard';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../store/projectStore';
import { mockStoryboardScenes, mockScript, aiSuggestedCards } from '../data/mockData';
import { useCredits } from '../hooks/useCredits';
import { useDeck, MAX_AI_SLOTS } from '../hooks/useDeck';
import { useGeneration } from '../hooks/useGeneration';
import { syncScenesImageToClips } from '../utils/narration-sync';

type StoryboardPhase = 'script-review' | 'cast-setup' | 'seed-check' | 'generating-video' | 'complete';

const StoryboardPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary,
        aiModelPreferences, setAiModelPreference, mode,
        narrationStep, setNarrationStep, narrationClips, setNarrationClips,
    } = useProjectStore();
    const { remaining: creditsRemaining, canAfford, spend, CREDIT_COSTS } = useCredits();

    const [phase, setPhase] = useState<StoryboardPhase>('cast-setup');
    const [selectedScene, setSelectedScene] = useState<string | null>(null);
    const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(true);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    // ScriptPage에서 씬을 생성했으면 그것을 사용, 없으면 목업 폴백
    const scenes = (storeScenes.length > 0 ? storeScenes : mockStoryboardScenes) as Scene[];
    const scriptCuts = storeScenes.length > 0
        ? storeScenes.map((s) => s.text)
        : mockScript;

    // ── 훅 ──
    const deckApi = useDeck({ cardLibrary, addToCardLibrary, canAfford, spend, creditsRemaining, CREDIT_COSTS });
    const genApi = useGeneration({
        scenes, deck: deckApi.deck, selectedStyle,
        canAfford, spend, creditsRemaining, CREDIT_COSTS,
        imageModel: aiModelPreferences.image,
        videoModel: aiModelPreferences.video,
    });

    // ── AI 분석 핸들러 (deckApi + genApi 양쪽 조율) ──
    const handleAiAnalysis = (doAnalysis: boolean) => {
        if (!doAnalysis) {
            const defaultDeck = aiSuggestedCards.slice(0, MAX_AI_SLOTS).map((c) => ({ ...c, source: 'ai' as const }));
            deckApi.setDeck(defaultDeck);
            defaultDeck.forEach((c) => addToCardLibrary(c));
            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                const allCardIds = defaultDeck.map((c) => c.id);
                scenes.forEach((s) => { updated[s.id] = [...allCardIds]; });
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

            const selectedChars = libChars.slice(0, 3).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedBgs = libBgs.slice(0, 1).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedItems = libItems.slice(0, 1).map((c) => ({ ...c, source: 'ai' as const, isRequired: true }));

            const aiCharsPool = aiSuggestedCards.filter((c) => c.type === 'character');
            const aiBgsPool = aiSuggestedCards.filter((c) => c.type === 'background');
            const aiItemsPool = aiSuggestedCards.filter((c) => c.type === 'item');

            while (selectedChars.length < 3 && aiCharsPool.length > 0) {
                const next = aiCharsPool.shift()!;
                if (!selectedChars.some((c) => c.id === next.id)) selectedChars.push({ ...next, source: 'ai', isRequired: true });
            }
            while (selectedBgs.length < 1 && aiBgsPool.length > 0) {
                const next = aiBgsPool.shift()!;
                if (!selectedBgs.some((c) => c.id === next.id)) selectedBgs.push({ ...next, source: 'ai', isRequired: true });
            }
            while (selectedItems.length < 1 && aiItemsPool.length > 0) {
                const next = aiItemsPool.shift()!;
                if (!selectedItems.some((c) => c.id === next.id)) selectedItems.push({ ...next, source: 'ai', isRequired: true });
            }

            const finalDeck = [...selectedChars, ...selectedBgs, ...selectedItems];
            finalDeck.forEach((c) => addToCardLibrary(c));
            deckApi.setDeck(finalDeck);

            genApi.setSceneSeeds((prev) => {
                const updated = { ...prev };
                const allCardIds = finalDeck.map((c) => c.id);
                scenes.forEach((s) => { updated[s.id] = [...allCardIds]; });
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

    // ── WorkflowSteps 매핑 (시네마틱) ──
    const workflowStep = (phase === 'seed-check' || phase === 'generating-video' || phase === 'complete') ? 3 : 2;
    const phaseToSub: Record<StoryboardPhase, string> = {
        'cast-setup': 'cast-setup',
        'script-review': 'cut-split',
        'seed-check': 'seed-match',
        'generating-video': 'video-gen',
        'complete': 'video-gen',
    };

    // 시네마틱 모드 메인 스텝 클릭
    const handleMainClick = (step: number) => {
        switch (step) {
            case 1: navigate('/project/idea'); break;
            case 2: if (workflowStep !== 2) setPhase('cast-setup'); break;
            case 3: if (workflowStep !== 3) setPhase('seed-check'); break;
            case 4: navigate('/project/timeline'); break;
        }
    };

    // 나레이션 모드 메인 스텝 클릭
    const handleNarrationMainClick = (step: number) => {
        setNarrationStep(step);
        const routes: Record<number, string> = {
            1: '/project/idea',
            2: '/project/timeline',
            3: '/project/timeline',
            4: '/project/storyboard',
            5: '/project/storyboard',
            6: '/project/timeline',
            7: '/project/timeline',
            8: '/project/timeline',
        };
        const target = routes[step];
        if (target && target !== '/project/storyboard') {
            navigate(target);
        } else if (step === 4) {
            setPhase('cast-setup');
        } else if (step === 5) {
            setPhase('seed-check');
        }
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
        // narrationStep에 따라 currentMain 결정 (4 또는 5)
        const narrationMain = narrationStep === 5 ? 5 : 4;

        return (
            <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* 헤더 */}
                <div className="storyboard-header">
                    <h2 className="storyboard-header__title">강철의 북진</h2>
                    <div className="storyboard-header__center">
                        <WorkflowSteps
                            currentMain={narrationMain}
                            currentSub={phaseToSub[phase]}
                            onMainClick={handleNarrationMainClick}
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
                        selectedStyle={selectedStyle}
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
                    />
                )}
            </div>
        );
    }

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* 헤더 */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">강철의 북진</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps
                        currentMain={workflowStep}
                        currentSub={phaseToSub[phase]}
                        onMainClick={handleMainClick}
                    />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn" disabled title="Animate 단계에서 이용 가능">Export</button>
                    <button className="btn-icon"><HelpCircle size={16} /></button>
                </div>
            </div>

            {/* ── Phase: 카드 선택 ── */}
            {phase === 'cast-setup' && (
                <CastSetupPhase
                    deckApi={deckApi}
                    showAiAnalysisModal={showAiAnalysisModal}
                    isAiAnalyzing={isAiAnalyzing}
                    onAiAnalysis={handleAiAnalysis}
                    onNextPhase={() => {
                        // 시네마틱 모드: script-review → seed-check 순서
                        setPhase('script-review');
                    }}
                />
            )}

            {/* ── Phase: 컷 분할 ── */}
            {phase === 'script-review' && (
                <CutSplitPhase
                    scriptCuts={scriptCuts}
                    scenes={scenes}
                    videoCountPerScene={genApi.videoCountPerScene}
                    setVideoCountPerScene={genApi.setVideoCountPerScene}
                    deckApi={deckApi}
                    onPrevPhase={() => setPhase('cast-setup')}
                    onNextPhase={() => setPhase('seed-check')}
                />
            )}

            {/* ── Phase: 시드 매칭 & 생성 ── */}
            {phase === 'seed-check' && (
                <SeedCheckPhase
                    scenes={scenes}
                    deck={deckApi.deck}
                    selectedStyle={selectedStyle}
                    selectedScene={selectedScene}
                    setSelectedScene={setSelectedScene}
                    genApi={genApi}
                    deckApi={deckApi}
                    getSceneGradient={getSceneGradient}
                    onPrevPhase={() => setPhase('script-review')}
                    onNavigateToTimeline={() => navigate('/project/timeline')}
                    imageModel={aiModelPreferences.image}
                    videoModel={aiModelPreferences.video}
                    onImageModelChange={(id) => setAiModelPreference('image', id)}
                    onVideoModelChange={(id) => setAiModelPreference('video', id)}
                />
            )}
        </div>
    );
};

export default StoryboardPage;
