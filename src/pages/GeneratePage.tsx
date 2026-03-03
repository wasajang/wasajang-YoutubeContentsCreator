/**
 * GeneratePage — 시네마틱 3단계: 씨드 매칭 + 이미지/영상 생성
 *
 * StoryboardPage에서 카드 선택 + 컷 분할 후,
 * 이 페이지에서 프롬프트 편집 → 이미지 생성 → 영상 생성을 수행합니다.
 * (나레이션 모드에서는 사용하지 않음 — StoryboardPage 내에서 처리)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import CreditShortageModal from '../components/CreditShortageModal';
import { SeedCheckPhase } from '../components/storyboard';
import { useProjectStore } from '../store/projectStore';
import type { Scene } from '../store/projectStore';
import { useCredits } from '../hooks/useCredits';
import { useDeck } from '../hooks/useDeck';
import { useGeneration } from '../hooks/useGeneration';

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

export default GeneratePage;
