import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Pencil, Wand2, Check, Minus, Plus, ArrowRight, RotateCcw, Loader,
    FileText,
} from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import { mockScript, mockCardLibrary } from '../data/mockData';
import { artStyles } from '../data/artStyles';
import { getTemplateById, getTemplatesByMode } from '../data/templates';
import type { Template } from '../data/templates';
import { generateScript } from '../services/ai-llm';
import { useCredits } from '../hooks/useCredits';
import { getUserSelectableModels } from '../data/aiModels';

type InputMode = 'script' | 'idea';

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
        mode, setNarrationStep,
    } = useProjectStore();
    const { canAfford, spend, remaining: creditsRemaining, CREDIT_COSTS } = useCredits();

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
            alert(`크레딧이 부족합니다! (대본 생성 ${CREDIT_COSTS.script} 크레딧 필요, 잔여: ${creditsRemaining})`);
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
            alert('대본 생성에 실패했습니다. 다시 시도해주세요.');
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

    // ── 스타일 그라디언트 ──
    const getStyleGradient = (color: string) =>
        `linear-gradient(145deg, ${color} 0%, ${color}88 50%, ${color}44 100%)`;

    // ── 워크플로우 클릭 ──
    const handleMainClick = (step: number) => {
        switch (step) {
            case 1: break;
            case 2: navigate('/project/storyboard'); break;
            case 3: navigate('/project/storyboard'); break;
            case 4: navigate('/project/timeline'); break;
        }
    };

    const aspectOptions: { ratio: '16:9' | '9:16' | '1:1'; label: string }[] = [
        { ratio: '16:9', label: '16:9' },
        { ratio: '9:16', label: '9:16' },
        { ratio: '1:1', label: '1:1' },
    ];

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
                        currentMain={1}
                        currentSub={''}
                        onMainClick={handleMainClick}
                        onSubClick={() => {}}
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

            {/* ═══ 3분할 레이아웃 ═══ */}
            <div className="idea-layout">
                {/* ── 1열: 대본 작성 ── */}
                <div className="idea-layout__script">
                    <div className="idea-col-header">
                        <h3 className="idea-col-title">1. 대본 작성</h3>
                    </div>

                    {/* 입력 모드 탭 */}
                    <div className="script-input-tabs" style={{ padding: '0 16px', marginBottom: 0 }}>
                        <button
                            className={`script-input-tab ${inputMode === 'idea' ? 'active' : ''}`}
                            onClick={() => setInputMode('idea')}
                        >
                            <Wand2 size={13} /> 아이디어 입력
                        </button>
                        <button
                            className={`script-input-tab ${inputMode === 'script' ? 'active' : ''}`}
                            onClick={() => setInputMode('script')}
                        >
                            대본 직접 입력
                        </button>
                    </div>

                    {/* 텍스트 입력 */}
                    <div className="idea-col-body">
                        {inputMode === 'script' ? (
                            <textarea
                                className="script-textarea idea-textarea"
                                placeholder={`대본을 여기에 붙여넣거나 직접 입력하세요.\n\n문단을 빈 줄로 구분하면 씬 분할 시 기준으로 사용됩니다.`}
                                value={rawScript}
                                onChange={(e) => setRawScript(e.target.value)}
                            />
                        ) : (
                            <textarea
                                className="script-textarea idea-textarea"
                                placeholder={currentTemplate?.sampleIdea || `영상의 아이디어나 줄거리를 자유롭게 입력하세요.\n\n예시: "1950년대 한국전쟁 중 미래에서 온 현대 군대가 타임포털을 통해 나타나 전세를 바꾼다."`}
                                value={ideaText}
                                onChange={(e) => setIdeaText(e.target.value)}
                            />
                        )}
                    </div>

                    {/* 씬 이미지 시각화 (씬 개수/분할 버튼은 2열로 이동) */}
                    <div className="idea-col-footer">
                        {mode === 'narration' ? (
                            <div className="scene-image-preview">
                                <div className="scene-image-preview__title" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    대본을 입력하면 음성을 먼저 생성합니다
                                </div>
                            </div>
                        ) : (
                        <div className="scene-image-preview">
                            <div className="scene-image-preview__title">
                                씬 {sceneCount}개 = 시작 이미지 {sceneCount}장 (약 {sceneCount * 5}초)
                            </div>
                            <div className="scene-image-preview__boxes">
                                {Array.from({ length: Math.min(sceneCount, 12) }, (_, i) => (
                                    <div key={i} className="scene-image-preview__box">
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                ))}
                                {sceneCount > 12 && (
                                    <span className="scene-image-preview__more">+{sceneCount - 12}</span>
                                )}
                            </div>
                        </div>
                        )}

                        {inputMode === 'idea' && (
                            <div className="ai-model-row">
                                <label className="ai-model-row__label">대본 AI</label>
                                <select
                                    className="ai-model-select"
                                    value={aiModelPreferences.script}
                                    onChange={(e) => setAiModelPreference('script', e.target.value)}
                                >
                                    {getUserSelectableModels('script').map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 2열: 설정 선택 ── */}
                <div className="idea-layout__settings">
                    <div className="idea-col-header">
                        <h3 className="idea-col-title">2. 설정 선택</h3>
                    </div>

                    <div className="idea-settings-body">
                        {/* 프리셋 섹션 */}
                        {modeTemplates.length > 0 && (
                            <div className="idea-settings-section">
                                <div className="idea-settings-label">
                                    {mode === 'cinematic' ? '시네마틱 프리셋' : '나레이션 프리셋'}
                                </div>
                                <div className="idea-style-chips">
                                    {modeTemplates.map((tmpl) => (
                                        <button
                                            key={tmpl.id}
                                            className={`idea-style-chip ${templateId === tmpl.id ? 'selected' : ''}`}
                                            onClick={() => handlePresetClick(tmpl)}
                                        >
                                            {tmpl.thumbnail ? (
                                                <img src={tmpl.thumbnail} alt={tmpl.name} className="idea-style-chip__img" />
                                            ) : (
                                                <div className="idea-style-chip__img" style={{ background: 'var(--bg-tertiary)' }} />
                                            )}
                                            <span className="idea-style-chip__label">{tmpl.name}</span>
                                            {templateId === tmpl.id && (
                                                <Check size={12} className="idea-style-chip__check" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 프리셋 적용 안내 */}
                        {templateId && currentTemplate && (
                            <div className="preset-script-notice">
                                '{currentTemplate.name}' 템플릿의 대본 작성 규칙이 적용됩니다
                            </div>
                        )}

                        {/* 아트 스타일 */}
                        <div className="idea-settings-section">
                            <div className="idea-settings-label">아트 스타일</div>
                            <div className="idea-style-chips">
                                {artStyles.map((style) => (
                                    <button
                                        key={style.id}
                                        className={`idea-style-chip ${artStyleId === style.id ? 'selected' : ''}`}
                                        onClick={() => handleArtStyleChange(style.id)}
                                    >
                                        {style.thumbnail ? (
                                            <img src={style.thumbnail} alt={style.nameKo} className="idea-style-chip__img" />
                                        ) : (
                                            <div
                                                className="idea-style-chip__img"
                                                style={{ background: getStyleGradient(style.color || '#333') }}
                                            />
                                        )}
                                        <span className="idea-style-chip__label">{style.nameKo}</span>
                                        {artStyleId === style.id && (
                                            <Check size={12} className="idea-style-chip__check" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 화면 비율 */}
                        <div className="idea-settings-section">
                            <div className="idea-settings-label">화면 비율</div>
                            <div className="idea-aspect-options">
                                {aspectOptions.map((opt) => (
                                    <button
                                        key={opt.ratio}
                                        className={`idea-aspect-btn ${aspectRatio === opt.ratio ? 'selected' : ''}`}
                                        onClick={() => handleAspectChange(opt.ratio)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 씬 개수 선택 + 예상 시간 (나레이션 모드에서는 숨김) */}
                        {mode !== 'narration' && (
                            <div className="idea-settings-section">
                                <div className="idea-settings-label">씬 개수</div>
                                <div className="scene-count-picker" style={{ justifyContent: 'flex-start' }}>
                                    <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.max(1, n - 1))}>
                                        <Minus size={12} />
                                    </button>
                                    <span className="scene-count-value">{sceneCount} scenes</span>
                                    <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.min(30, n + 1))}>
                                        <Plus size={12} />
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                    예상 영상 길이: 약 {sceneCount * 5}초 ({Math.floor(sceneCount * 5 / 60)}분 {(sceneCount * 5) % 60}초)
                                </p>
                            </div>
                        )}

                        {/* 씬 분할 / AI 생성 / 다음 버튼 */}
                        <div className="idea-settings-section">
                            {mode === 'narration' ? (
                                inputMode === 'idea' ? (
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%' }}
                                        onClick={handleIdeaGenerate}
                                        disabled={!ideaText.trim() || isIdeaGenerating}
                                    >
                                        {isIdeaGenerating ? (
                                            <><Loader size={14} className="animate-spin" /> 생성 중...</>
                                        ) : (
                                            <><Wand2 size={14} /> AI로 대본 생성</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%' }}
                                        onClick={() => {
                                            // 대본 전체를 1개 씬으로 store에 저장 (나레이션은 TTS 후 분할)
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
                                        }}
                                        disabled={!rawScript.trim()}
                                    >
                                        다음: 음성 생성 <ArrowRight size={14} />
                                    </button>
                                )
                            ) : (
                                inputMode === 'script' ? (
                                    <button className="btn-primary" style={{ width: '100%' }} onClick={handleGenerateScript}>
                                        씬 분할하기 <ArrowRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%' }}
                                        onClick={handleIdeaGenerate}
                                        disabled={!ideaText.trim() || isIdeaGenerating}
                                    >
                                        {isIdeaGenerating ? (
                                            <><Loader size={14} className="animate-spin" /> 생성 중...</>
                                        ) : (
                                            <><Wand2 size={14} /> AI로 대본 생성</>
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 3열: 결과 (Script Breakdown) ── */}
                <div className="idea-layout__result">
                    <div className="idea-col-header idea-col-header--result">
                        <h3 className="idea-col-title">3. 결과 확인</h3>
                        {isGenerated && (
                            <button className="btn-secondary script-reset-btn" onClick={handleReset}>
                                <RotateCcw size={13} /> 다시 입력
                            </button>
                        )}
                    </div>

                    {isGenerated ? (
                        <div className="idea-result-body">
                            <div className="idea-result-meta">
                                <span className="idea-result-count">{scenes.length}개 씬</span>
                            </div>
                            <div className="idea-scene-list">
                                {scenes.map((scene, i) => (
                                    <div key={scene.id} className="idea-scene-item">
                                        <span className="script-scene-num">{String(i + 1).padStart(2, '0')}</span>
                                        {editingSceneId === scene.id ? (
                                            <textarea
                                                className="script-scene-edit"
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                onBlur={handleSaveEdit}
                                                onKeyDown={(e) => e.key === 'Escape' && setEditingSceneId(null)}
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="script-editor__scene-text">{scene.text}</p>
                                        )}
                                        <div className="script-scene-actions">
                                            <button className="btn-icon" title="편집" onClick={() => handleEditScene(scene.id, scene.text)}>
                                                <Pencil size={13} />
                                            </button>
                                            <div
                                                className={`script-editor__scene-check ${scene.checked ? 'checked' : ''}`}
                                                onClick={() => toggleSceneCheck(scene.id)}
                                                title="씬 포함 여부"
                                            >
                                                <Check size={16} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="idea-layout__result-placeholder">
                            <FileText size={32} opacity={0.15} />
                            <p>대본을 생성하면 여기에 씬 목록이 표시됩니다</p>
                        </div>
                    )}
                </div>
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
                            // 대본이 store에 없으면 rawScript를 1개 씬으로 저장
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

            {/* ── 프리셋 확인 팝업 ── */}
            {pendingPreset && (
                <div className="preset-confirm-overlay" onClick={() => setPendingPreset(null)}>
                    <div className="preset-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="preset-confirm-modal__title">
                            '{pendingPreset.name}' 템플릿 적용
                        </h3>
                        <p className="preset-confirm-modal__desc">
                            이 템플릿의 설정과 프롬프트 규칙을 모두 적용할까요?
                        </p>
                        <div className="preset-confirm-modal__info">
                            <div>아트 스타일: {artStyles.find(s => s.id === pendingPreset.artStyleId)?.nameKo || pendingPreset.artStyleId}</div>
                            <div>화면 비율: {pendingPreset.aspectRatio}</div>
                            <div>추천 씬 수: {pendingPreset.promptRules?.sceneSplitRules?.defaultSceneCount || '-'}</div>
                        </div>
                        <div className="preset-confirm-modal__actions">
                            <button className="btn-secondary" onClick={() => setPendingPreset(null)}>
                                아니요
                            </button>
                            <button className="btn-primary" onClick={handlePresetConfirm}>
                                <Check size={14} /> 예, 적용
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IdeaPage;
