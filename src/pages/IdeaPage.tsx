import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import WorkflowSteps, { narrationStepToGroup, narrationStepToSubKey } from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import { mockScript, mockCardLibrary } from '../data/mockData';
import { getTemplateById, getTemplatesByMode } from '../data/templates';
import type { Template } from '../data/templates';
import { generateScript } from '../services/ai-llm';
import { useCredits } from '../hooks/useCredits';
import { useToast } from '../hooks/useToast';
import PresetConfirmModal from '../components/idea/PresetConfirmModal';
import IdeaResultPanel from '../components/idea/IdeaResultPanel';
import ScriptInputPanel from '../components/idea/ScriptInputPanel';
import type { InputMode } from '../components/idea/ScriptInputPanel';
import IdeaSettingsPanel from '../components/idea/IdeaSettingsPanel';

// ── 텍스트를 N개 씬으로 균등 분할하는 함수 ──
function splitScriptIntoScenes(text: string, count: number) {
    const source = text.trim() || mockScript.join('\n\n');

    // 다단계 분할: 빈 줄 → 줄바꿈 → 문장 → 글자 수
    let chunks = source.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    // 빈 줄 기준으로 충분하지 않으면 줄바꿈 기준 추가 분할
    if (chunks.length < count) {
        chunks = source.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    }

    // 줄바꿈으로도 부족하면 문장 기준 분할 (. ! ? 。)
    if (chunks.length < count) {
        const sentences = source.match(/[^.!?。\n]+[.!?。]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [source];
        chunks = sentences;
    }

    if (chunks.length === 0) return [];

    // 목표 씬 수로 균등 그룹화
    const result: string[] = [];
    const targetCount = Math.min(count, Math.max(chunks.length, 1));
    const groupSize = chunks.length / targetCount;

    for (let i = 0; i < targetCount; i++) {
        const start = Math.round(i * groupSize);
        const end = Math.round((i + 1) * groupSize);
        result.push(chunks.slice(start, end).join(' '));
    }

    // 문장 분할로도 부족하면 가장 긴 것을 반복 분할
    while (result.length < count) {
        const longest = result.reduce((a, b) => (a.length > b.length ? a : b));
        const idx = result.indexOf(longest);
        if (longest.length < 20) break; // 너무 짧으면 더 이상 분할 안 함
        const mid = Math.ceil(longest.length / 2);
        // 공백 기준으로 가장 가까운 위치에서 분할
        let splitPos = longest.lastIndexOf(' ', mid);
        if (splitPos <= 0) splitPos = mid;
        result.splice(idx, 1, longest.slice(0, splitPos).trim(), longest.slice(splitPos).trim());
    }

    return result.slice(0, count).filter((t) => t.length > 0).map((text, i) => ({
        id: `scene-${i + 1}`,
        text: text.trim(),
        location: '',
        cameraAngle: '',
        imageUrl: '',
        characters: [] as string[],
        status: 'pending' as const,
        checked: true,
    }));
}

const IdeaPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title, setTitle, scenes, setScenes,
        aspectRatio, setAspectRatio, toggleSceneCheck,
        artStyleId, setArtStyleId,
        cardLibrary, addToCardLibrary,
        hasActiveProject, startNewProject,
        templateId, setTemplateId,
        aiModelPreferences, setAiModelPreference,
        mode, setMode, narrationStep, setNarrationStep,
    } = useProjectStore();
    const { canAfford, spend } = useCredits();
    const { showToast } = useToast();

    // NavBar "New Project" 링크로 진입 시 hasActiveProject가 false일 수 있음
    useEffect(() => {
        if (!hasActiveProject) {
            startNewProject(title || 'Untitled Project', mode);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 공통 상태 ──
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const [inputMode, setInputMode] = useState<InputMode>('script');
    const [rawScript, setRawScript] = useState('');
    const [ideaText, setIdeaText] = useState('');
    const [sceneCount, setSceneCount] = useState(() => {
        if (templateId) {
            const tmpl = getTemplateById(templateId);
            return tmpl?.promptRules?.sceneSplitRules?.defaultSceneCount ?? 10;
        }
        return 10;
    });
    const [isGenerated, setIsGenerated] = useState(scenes.length > 0);
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [isIdeaGenerating, setIsIdeaGenerating] = useState(false);

    // ── 프리셋 확인 팝업 상태 ──
    const [pendingPreset, setPendingPreset] = useState<Template | null>(null);

    // ── Cast 초기화 (cardLibrary가 비어있으면 mockCardLibrary로 채움) ──
    React.useEffect(() => {
        if (cardLibrary.length === 0) {
            mockCardLibrary.forEach((c) => addToCardLibrary(c));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 단계 인디케이터 조건 ──
    const hasScript = rawScript.trim().length > 0 || ideaText.trim().length > 0;
    const hasSettings = artStyleId !== '';

    // ── Script 핸들러 ──
    const handleTitleSave = () => {
        setTitle(editTitle);
        setIsEditing(false);
    };

    const handleGenerateScript = () => {
        const generated = splitScriptIntoScenes(rawScript, sceneCount);
        setScenes(generated);
        setIsGenerated(true);
    };

    const handleIdeaGenerate = async () => {
        if (!ideaText.trim()) return;

        if (!canAfford('script')) {
            showToast('크레딧이 부족합니다! 대본 생성에 크레딧이 필요합니다.', 'warning');
            return;
        }
        if (!spend('script')) return;

        setIsIdeaGenerating(true);
        try {
            const result = await generateScript({
                idea: ideaText,
                sceneCount,
                style: artStyleId,
                model: aiModelPreferences.script,
                presetId: templateId ?? undefined,
                mode,
            });
            const storeScenes = result.scenes.map((s) => ({
                id: s.id,
                text: s.text,
                location: s.location,
                cameraAngle: s.cameraAngle,
                imageUrl: '',
                characters: [],
                status: 'pending' as const,
                checked: true,
            }));
            setScenes(storeScenes);
            setIsGenerated(true);
        } catch (err) {
            console.error('[IdeaPage] 대본 생성 실패:', err);
            showToast('대본 생성에 실패했습니다. 다시 시도해주세요.', 'error');
        } finally {
            setIsIdeaGenerating(false);
        }
    };

    const handleReset = () => {
        setIsGenerated(false);
        setScenes([]);
    };

    const handleEditScene = (id: string, text: string) => {
        setEditingSceneId(id);
        setEditingText(text);
    };

    const handleSaveEdit = () => {
        if (!editingSceneId) return;
        setScenes(scenes.map((s) => s.id === editingSceneId ? { ...s, text: editingText } : s));
        setEditingSceneId(null);
    };

    // ── 프리셋 선택/해제 핸들러 ──
    const handlePresetSelect = (tmpl: Template) => {
        setTemplateId(tmpl.id);
        setArtStyleId(tmpl.artStyleId);
        setAspectRatio(tmpl.aspectRatio);
        if (tmpl.defaultModels) {
            Object.entries(tmpl.defaultModels).forEach(([category, modelId]) => {
                setAiModelPreference(category as 'script' | 'image' | 'video' | 'tts', modelId);
            });
        }
        if (tmpl.promptRules?.sceneSplitRules?.defaultSceneCount) {
            setSceneCount(tmpl.promptRules.sceneSplitRules.defaultSceneCount);
        }
    };

    // 프리셋 칩 클릭 → 확인 팝업
    const handlePresetClick = (tmpl: Template) => {
        setPendingPreset(tmpl);
    };

    const handlePresetConfirm = () => {
        if (!pendingPreset) return;
        handlePresetSelect(pendingPreset);
        setPendingPreset(null);
    };

    // ── 모드 전환 핸들러 ──
    const handleModeSwitch = (newMode: 'cinematic' | 'narration') => {
        if (newMode === mode) return;
        setMode(newMode);
        setTemplateId(null);          // 모드별 템플릿이 다르므로 리셋
        setSceneCount(10);            // 씬 개수도 기본값 리셋
        if (newMode === 'narration') {
            setNarrationStep(1);      // 나레이션 모드 진입 시 1단계부터
        }
    };

    // 아트스타일 수동 변경 → 프리셋 해제
    const handleArtStyleChange = (styleId: string) => {
        setArtStyleId(styleId);
        if (templateId) {
            const tmpl = getTemplateById(templateId);
            if (tmpl && tmpl.artStyleId !== styleId) {
                setTemplateId(null);
            }
        }
    };

    // 비율 수동 변경 → 프리셋 해제
    const handleAspectChange = (ratio: '16:9' | '9:16' | '1:1') => {
        setAspectRatio(ratio);
        if (templateId) {
            const tmpl = getTemplateById(templateId);
            if (tmpl && tmpl.aspectRatio !== ratio) {
                setTemplateId(null);
            }
        }
    };

    // 나레이션 모드 직접 입력 → 저장 후 이동
    const handleNarrationScriptSave = () => {
        setScenes([{
            id: 'scene-1',
            text: rawScript.trim(),
            location: '', cameraAngle: '', imageUrl: '',
            characters: [] as string[],
            status: 'pending' as const,
            checked: true,
        }]);
        setIsGenerated(true);
        setNarrationStep(2);
        navigate('/project/timeline');
    };

    // ── 워크플로우 클릭 ──
    const handleMainClick = (step: number) => {
        if (mode === 'narration') {
            const groupFirstStep: Record<number, number> = { 1: 1, 2: 4, 3: 6, 4: 8 };
            const groupRoute: Record<number, string> = {
                1: '/project/idea', 2: '/project/storyboard',
                3: '/project/timeline', 4: '/project/timeline',
            };
            setNarrationStep(groupFirstStep[step] || 1);
            const route = groupRoute[step];
            if (route && route !== '/project/idea') navigate(route);
        } else {
            switch (step) {
                case 1: break;
                case 2: navigate('/project/storyboard'); break;
                case 3: navigate('/project/generate'); break;
                case 4: navigate('/project/timeline'); break;
            }
        }
    };

    // ── 다음 버튼 활성화 조건 ──
    const canProceed = mode === 'narration'
        ? (isGenerated && scenes.length > 0 && artStyleId !== '') || rawScript.trim().length > 0
        : isGenerated && scenes.length > 0 && artStyleId !== '';

    // ── 현재 선택된 템플릿 ──
    const currentTemplate = templateId ? getTemplateById(templateId) : null;

    // ── 현재 모드의 템플릿 목록 ──
    const modeTemplates = getTemplatesByMode(mode);

    return (
        <div className="page-container">
            {/* Phase Header */}
            <div className="phase-header">
                <div className="phase-header__left">
                    <div className="phase-header__title">
                        {isEditing ? (
                            <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={handleTitleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                                autoFocus
                                style={{
                                    background: 'var(--bg-input)',
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-accent)',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    width: '300px',
                                }}
                            />
                        ) : (
                            <>
                                {title || 'Untitled Project'}
                                <button
                                    className="btn-icon"
                                    onClick={() => { setEditTitle(title); setIsEditing(true); }}
                                >
                                    <Pencil size={14} />
                                </button>
                            </>
                        )}
                    </div>
                    <WorkflowSteps
                        currentMain={mode === 'narration' ? narrationStepToGroup(narrationStep) : 1}
                        currentSub={mode === 'narration' ? narrationStepToSubKey(narrationStep) : ''}
                        onMainClick={handleMainClick}
                    />
                </div>

                {/* 단계 인디케이터 */}
                <div className="idea-steps-indicator">
                    <div className={`idea-step ${isGenerated ? 'done' : hasScript ? 'active' : ''}`}>
                        <span className="idea-step__num">1</span>
                        <span>대본 작성</span>
                    </div>
                    <div className="idea-step__arrow">&rsaquo;</div>
                    <div className={`idea-step ${hasSettings && isGenerated ? 'done' : isGenerated ? 'active' : ''}`}>
                        <span className="idea-step__num">2</span>
                        <span>설정 선택</span>
                    </div>
                    <div className="idea-step__arrow">&rsaquo;</div>
                    <div className={`idea-step ${isGenerated && hasSettings ? 'active' : ''}`}>
                        <span className="idea-step__num">3</span>
                        <span>결과 확인</span>
                    </div>
                </div>
            </div>

            {/* 3분할 레이아웃 */}
            <div className="idea-layout">
                <ScriptInputPanel
                    inputMode={inputMode}
                    rawScript={rawScript}
                    ideaText={ideaText}
                    sceneCount={sceneCount}
                    mode={mode}
                    aiModelPreferences={aiModelPreferences}
                    currentTemplateSampleIdea={currentTemplate?.sampleIdea}
                    onInputModeChange={setInputMode}
                    onRawScriptChange={setRawScript}
                    onIdeaTextChange={setIdeaText}
                    onAiModelPreferenceChange={setAiModelPreference}
                />

                <IdeaSettingsPanel
                    mode={mode}
                    templateId={templateId}
                    artStyleId={artStyleId}
                    aspectRatio={aspectRatio}
                    sceneCount={sceneCount}
                    modeTemplates={modeTemplates}
                    currentTemplate={currentTemplate ?? null}
                    rawScript={rawScript}
                    ideaText={ideaText}
                    inputMode={inputMode}
                    isIdeaGenerating={isIdeaGenerating}
                    onModeSwitch={handleModeSwitch}
                    onPresetClick={handlePresetClick}
                    onArtStyleChange={handleArtStyleChange}
                    onAspectChange={handleAspectChange}
                    onSceneCountChange={setSceneCount}
                    onGenerateScript={handleGenerateScript}
                    onIdeaGenerate={handleIdeaGenerate}
                    onNarrationScriptSave={handleNarrationScriptSave}
                />

                <IdeaResultPanel
                    scenes={scenes}
                    isGenerated={isGenerated}
                    editingSceneId={editingSceneId}
                    editingText={editingText}
                    onEditScene={handleEditScene}
                    onSaveEdit={handleSaveEdit}
                    onEditingTextChange={setEditingText}
                    onCancelEdit={() => setEditingSceneId(null)}
                    onToggleSceneCheck={toggleSceneCheck}
                    onReset={handleReset}
                />
            </div>

            {/* Bottom Navigation */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 40px',
                flexShrink: 0,
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
            }}>
                {!canProceed && (
                    <span className="idea-bottom__hint">
                        {!isGenerated ? '대본을 먼저 생성해주세요' : !artStyleId ? '아트 스타일을 선택해주세요' : ''}
                    </span>
                )}
                <button
                    className="btn-primary"
                    disabled={!canProceed}
                    onClick={() => {
                        if (mode === 'narration') {
                            if (scenes.length === 0 && rawScript.trim()) {
                                setScenes([{
                                    id: 'scene-1',
                                    text: rawScript.trim(),
                                    location: '', cameraAngle: '', imageUrl: '',
                                    characters: [] as string[],
                                    status: 'pending' as const,
                                    checked: true,
                                }]);
                            }
                            setNarrationStep(2);
                            navigate('/project/timeline');
                        } else {
                            navigate('/project/storyboard');
                        }
                    }}
                >
                    {mode === 'narration' ? '다음: 음성 생성 →' : '다음: 스토리보드 →'}
                </button>
            </div>

            {/* 프리셋 확인 팝업 */}
            {pendingPreset && (
                <PresetConfirmModal
                    pendingPreset={pendingPreset}
                    onConfirm={handlePresetConfirm}
                    onCancel={() => setPendingPreset(null)}
                />
            )}
        </div>
    );
};

export default IdeaPage;
