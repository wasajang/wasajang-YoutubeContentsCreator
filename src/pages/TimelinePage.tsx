/**
 * TimelinePage — Vrew 스타일 영상 편집기
 *
 * 시네마틱 모드: VrewEditor (3단 레이아웃)
 * 나레이션 모드: 스텝별 분기 (Voice/Split/Video/Edit/Export)
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import WorkflowSteps, { narrationStepToGroup, narrationStepToSubKey } from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import NarrationVoiceStep from '../components/narration/NarrationVoiceStep';
import NarrationSplitStep from '../components/narration/NarrationSplitStep';
import VrewEditor from '../components/editor/VrewEditor';

const TimelinePage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title, scenes: storeScenes,
        mode, narrationStep, setNarrationStep,
    } = useProjectStore();

    // ── 나레이션 모드 — 그룹 클릭 시 라우팅 (4그룹 체계) ──
    const handleNarrationMainClick = useCallback((group: number) => {
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
        if (route && route !== '/project/timeline') {
            navigate(route);
        }
    }, [setNarrationStep, navigate]);

    // ── 나레이션 모드 — 서브스텝 클릭 시 라우팅 ──
    const handleNarrationSubClick = useCallback((subKey: string) => {
        const subKeyToStep: Record<string, number> = {
            'script': 1, 'voice': 2, 'split': 3,
            'cast-setup': 4, 'image-gen': 5,
            'video': 6, 'edit': 7, 'export': 8,
        };
        const step = subKeyToStep[subKey];
        if (!step) return;
        setNarrationStep(step);
        const routeMap: Record<string, string> = {
            'script': '/project/idea',
            'cast-setup': '/project/storyboard', 'image-gen': '/project/storyboard',
            'video': '/project/storyboard',
        };
        const route = routeMap[subKey];
        if (route) navigate(route);
    }, [setNarrationStep, navigate]);

    // ── 나레이션 모드 분기 ──
    if (mode === 'narration') {
        // Step 2: Voice (TTS 생성)
        if (narrationStep <= 2) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={narrationStepToGroup(narrationStep)} currentSub={narrationStepToSubKey(narrationStep)} onMainClick={handleNarrationMainClick} onSubClick={handleNarrationSubClick} />
                    <NarrationVoiceStep
                        onNext={() => setNarrationStep(3)}
                        onPrev={() => {
                            setNarrationStep(1);
                            navigate('/project/idea');
                        }}
                    />
                </div>
            );
        }
        // Step 3: Split (씬 분할)
        if (narrationStep === 3) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={narrationStepToGroup(narrationStep)} currentSub={narrationStepToSubKey(narrationStep)} onMainClick={handleNarrationMainClick} onSubClick={handleNarrationSubClick} />
                    <NarrationSplitStep
                        onNext={() => {
                            setNarrationStep(4);
                            navigate('/project/storyboard');
                        }}
                        onPrev={() => setNarrationStep(2)}
                    />
                </div>
            );
        }
        // Step 6: Video — StoryboardPage 모달로 이동, 여기 오면 storyboard로 리다이렉트
        if (narrationStep === 6) {
            navigate('/project/storyboard');
            return null;
        }
        // Step 7: Edit — Vrew 편집기
        if (narrationStep === 7) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={narrationStepToGroup(narrationStep)} currentSub={narrationStepToSubKey(narrationStep)} onMainClick={handleNarrationMainClick} onSubClick={handleNarrationSubClick} />
                    <VrewEditor
                        onNext={() => setNarrationStep(8)}
                        onPrev={() => {
                            setNarrationStep(5);
                            navigate('/project/storyboard');
                        }}
                    />
                </div>
            );
        }
        // Step 8: Export — placeholder
        if (narrationStep >= 8) {
            return (
                <div className="page-container">
                    <WorkflowSteps currentMain={narrationStepToGroup(narrationStep)} currentSub={narrationStepToSubKey(narrationStep)} onMainClick={handleNarrationMainClick} onSubClick={handleNarrationSubClick} />
                    <div className="narration-placeholder">
                        <p>Step 8: 내보내기 (구현 예정)</p>
                    </div>
                </div>
            );
        }
    }

    // ── 시네마틱 모드 — Vrew 편집기 ──
    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">{title || 'Untitled Project'}</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps
                        currentMain={4}
                        currentSub="timeline"
                        onMainClick={(step) => {
                            switch (step) {
                                case 1: navigate('/project/idea'); break;
                                case 2: navigate('/project/storyboard'); break;
                                case 3: navigate('/project/generate'); break;
                                case 4: break;
                            }
                        }}
                    />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn" disabled title="추후 지원 예정"><Download size={14} /> Export</button>
                </div>
            </div>

            {/* 씬이 없는 경우 안내 */}
            {storeScenes.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1rem' }}>아직 대본이 없습니다. 아이디어 페이지에서 대본을 먼저 작성해주세요.</p>
                    <button className="btn-primary" onClick={() => navigate('/project/idea')}>
                        아이디어 페이지로 이동
                    </button>
                </div>
            ) : (
                <VrewEditor />
            )}
        </div>
    );
};

export default TimelinePage;
