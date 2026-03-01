import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Pencil, Wand2, Check, Minus, Plus, ArrowRight, RotateCcw, Loader,
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
    const paragraphs = source
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) return [];

    const result: string[] = [];
    const total = paragraphs.length;
    const targetCount = Math.min(count, total);

    if (total >= targetCount) {
        const groupSize = total / targetCount;
        for (let i = 0; i < targetCount; i++) {
            const start = Math.round(i * groupSize);
            const end = Math.round((i + 1) * groupSize);
            result.push(paragraphs.slice(start, end).join(' '));
        }
    } else {
        result.push(...paragraphs);
        while (result.length < targetCount) {
            const longest = result.reduce((a, b) => (a.length > b.length ? a : b));
            const idx = result.indexOf(longest);
            const sentences = longest.match(/[^.!?]+[.!?]*/g) ?? [longest];
            if (sentences.length <= 1) break;
            const mid = Math.ceil(sentences.length / 2);
            result.splice(idx, 1, sentences.slice(0, mid).join(''), sentences.slice(mid).join(''));
        }
    }

    return result.slice(0, targetCount).map((text, i) => ({
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
    // 이 경우 자동으로 새 프로젝트를 시작 (DB 저장이 되도록)
    useEffect(() => {
        if (!hasActiveProject) {
            startNewProject(title || 'Untitled Project');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 공통 상태 ──
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const [inputMode, setInputMode] = useState<InputMode>('script');
    const [rawScript, setRawScript] = useState('');
    const [ideaText, setIdeaText] = useState('');
    const [sceneCount, setSceneCount] = useState(10);
    const [isGenerated, setIsGenerated] = useState(scenes.length > 0);
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [isIdeaGenerating, setIsIdeaGenerating] = useState(false);

    // ── Cast 초기화 (cardLibrary가 비어있으면 mockCardLibrary로 채움) ──
    React.useEffect(() => {
        if (cardLibrary.length === 0) {
            mockCardLibrary.forEach((c) => addToCardLibrary(c));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        // 크레딧 확인 & 차감
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
            // LLM 결과를 store 씬 형태로 변환
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
            case 1: break; // 이미 여기
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
    const canProceed = isGenerated && scenes.length > 0 && artStyleId !== '';

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
            </div>

            {/* ═══ 좌우 분할 레이아웃 ═══ */}
            <div className="idea-layout">
                {/* 좌: 대본 작성 */}
                <div className="idea-layout__script">
                    {!isGenerated ? (
                        <div className="script-input-area">
                            <div className="script-input-tabs">
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

                            {inputMode === 'script' ? (
                                <div className="script-input-body">
                                    <textarea
                                        className="script-textarea"
                                        placeholder={`대본을 여기에 붙여넣거나 직접 입력하세요.\n\n문단을 빈 줄로 구분하면 씬 분할 시 기준으로 사용됩니다.\n\n예시:\n첫 번째 씬 내용...\n\n두 번째 씬 내용...`}
                                        value={rawScript}
                                        onChange={(e) => setRawScript(e.target.value)}
                                    />
                                    <div className="script-input-footer">
                                        <div className="scene-count-picker">
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.max(1, n - 1))}>
                                                <Minus size={12} />
                                            </button>
                                            <span className="scene-count-value">{sceneCount} scenes</span>
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.min(30, n + 1))}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <button className="btn-primary script-generate-btn" onClick={handleGenerateScript}>
                                            Generate Script <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="script-input-body">
                                    <textarea
                                        className="script-textarea script-textarea--idea"
                                        placeholder={`영상의 아이디어나 줄거리를 자유롭게 입력하세요.\n\n예시: "1950년대 한국전쟁 중 미래에서 온 현대 군대가 타임포털을 통해 나타나 전세를 바꾼다. K2 전차와 아파치 헬기가 등장하며 두 시대의 병사들이 연대한다."`}
                                        value={ideaText}
                                        onChange={(e) => setIdeaText(e.target.value)}
                                    />
                                    <div className="script-input-footer">
                                        <div className="scene-count-picker">
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.max(1, n - 1))}>
                                                <Minus size={12} />
                                            </button>
                                            <span className="scene-count-value">{sceneCount} scenes</span>
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.min(30, n + 1))}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
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
                                        <button
                                            className="btn-primary script-generate-btn"
                                            onClick={handleIdeaGenerate}
                                            disabled={!ideaText.trim() || isIdeaGenerating}
                                        >
                                            {isIdeaGenerating ? (
                                                <><Loader size={14} className="animate-spin" /> 생성 중...</>
                                            ) : (
                                                <><Wand2 size={14} /> AI로 대본 생성</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="script-editor">
                            <div className="script-breakdown-header">
                                <h3 className="script-breakdown-title">Script Breakdown</h3>
                                <button className="btn-secondary script-reset-btn" onClick={handleReset}>
                                    <RotateCcw size={13} /> 다시 입력
                                </button>
                            </div>
                            {scenes.map((scene, i) => (
                                <div key={scene.id} className="script-editor__scene">
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
                    )}
                </div>

                {/* 우: 스타일 설정 */}
                <div className="idea-layout__style">
                    {/* 프리셋 섹션 */}
                    {modeTemplates.length > 0 && (
                        <div className="idea-style-section">
                            <div className="idea-style-section__title">
                                {mode === 'cinematic' ? '시네마틱 프리셋' : '나레이션 프리셋'}
                            </div>
                            <div className="idea-preset-row">
                                {modeTemplates.map((tmpl) => (
                                    <div
                                        key={tmpl.id}
                                        className={`idea-preset-chip${templateId === tmpl.id ? ' selected' : ''}`}
                                        onClick={() => handlePresetSelect(tmpl)}
                                    >
                                        {tmpl.thumbnail && (
                                            <img
                                                src={tmpl.thumbnail}
                                                alt={tmpl.name}
                                                className="idea-preset-chip__img"
                                            />
                                        )}
                                        <span className="idea-preset-chip__name">{tmpl.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 아트 스타일 섹션 */}
                    <div className="idea-style-section">
                        <div className="idea-style-section__title">아트 스타일</div>
                        <div className="idea-artstyle-grid">
                            {artStyles.map((style) => (
                                <div
                                    key={style.id}
                                    className={`idea-artstyle-card${artStyleId === style.id ? ' selected' : ''}`}
                                    onClick={() => handleArtStyleChange(style.id)}
                                >
                                    {style.thumbnail ? (
                                        <img
                                            src={style.thumbnail}
                                            className="idea-artstyle-card__img"
                                            alt={style.nameKo}
                                        />
                                    ) : (
                                        <div
                                            className="idea-artstyle-card__img"
                                            style={{ background: getStyleGradient(style.color || '#333') }}
                                        />
                                    )}
                                    <span className="idea-artstyle-card__label">{style.nameKo}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 화면 비율 섹션 */}
                    <div className="idea-style-section">
                        <div className="idea-style-section__title">화면 비율</div>
                        <div className="idea-ratio-row">
                            {aspectOptions.map((opt) => (
                                <button
                                    key={opt.ratio}
                                    className={`idea-ratio-btn${aspectRatio === opt.ratio ? ' selected' : ''}`}
                                    onClick={() => handleAspectChange(opt.ratio)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
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
                            setNarrationStep(2);
                            navigate('/project/timeline');
                        } else {
                            navigate('/project/storyboard');
                        }
                    }}
                >
                    {mode === 'narration' ? '다음: 나레이션 생성 →' : '다음: 스토리보드 →'}
                </button>
            </div>
        </div>
    );
};

export default IdeaPage;
