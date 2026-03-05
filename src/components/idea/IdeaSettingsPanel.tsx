import React from 'react';
import { Check, Minus, Plus, Wand2, ArrowRight, Loader } from 'lucide-react';
import { artStyles } from '../../data/artStyles';
import type { Template } from '../../data/templates';
import type { ProjectMode } from '../../store/projectStore';
import type { InputMode } from './ScriptInputPanel';

export interface IdeaSettingsPanelProps {
    mode: ProjectMode;
    templateId: string | null;
    artStyleId: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    sceneCount: number;
    modeTemplates: Template[];
    currentTemplate: Template | null;
    rawScript: string;
    ideaText: string;
    inputMode: InputMode;
    isIdeaGenerating: boolean;
    onModeSwitch: (mode: 'cinematic' | 'narration') => void;
    onPresetClick: (tmpl: Template) => void;
    onArtStyleChange: (styleId: string) => void;
    onAspectChange: (ratio: '16:9' | '9:16' | '1:1') => void;
    onSceneCountChange: (count: number) => void;
    onGenerateScript: () => void;
    onIdeaGenerate: () => void;
    onNarrationScriptSave: () => void;
}

const aspectOptions: { ratio: '16:9' | '9:16' | '1:1'; label: string }[] = [
    { ratio: '16:9', label: '16:9' },
    { ratio: '9:16', label: '9:16' },
    { ratio: '1:1', label: '1:1' },
];

const getStyleGradient = (color: string) =>
    `linear-gradient(145deg, ${color} 0%, ${color}88 50%, ${color}44 100%)`;

const IdeaSettingsPanel: React.FC<IdeaSettingsPanelProps> = ({
    mode,
    templateId,
    artStyleId,
    aspectRatio,
    sceneCount,
    modeTemplates,
    currentTemplate,
    rawScript,
    ideaText,
    inputMode,
    isIdeaGenerating,
    onModeSwitch,
    onPresetClick,
    onArtStyleChange,
    onAspectChange,
    onSceneCountChange,
    onGenerateScript,
    onIdeaGenerate,
    onNarrationScriptSave,
}) => {
    return (
        <div className="idea-layout__settings">
            <div className="idea-col-header">
                <h3 className="idea-col-title">2. 설정 선택</h3>
            </div>

            <div className="idea-settings-body">
                {/* 모드 전환 토글 */}
                <div className="idea-settings-section">
                    <div className="idea-settings-label">영상 모드</div>
                    <div className="idea-mode-toggle">
                        <button
                            className={`idea-mode-toggle__btn ${mode === 'cinematic' ? 'active' : ''}`}
                            onClick={() => onModeSwitch('cinematic')}
                        >
                            🎬 시네마틱
                        </button>
                        <button
                            className={`idea-mode-toggle__btn ${mode === 'narration' ? 'active' : ''}`}
                            onClick={() => onModeSwitch('narration')}
                        >
                            🎙️ 나레이션
                        </button>
                    </div>
                    <p className="idea-mode-toggle__hint">
                        {mode === 'cinematic'
                            ? '영상 중심: 대본 → 스토리보드 → AI 이미지/영상 생성 → 편집 (예: 예고편, 다큐, MV)'
                            : '음성 중심: 대본 → TTS 음성 생성 → 자막 편집 → 이미지 배치 (예: 해설, 교육, 뉴스)'}
                    </p>
                </div>

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
                                    onClick={() => onPresetClick(tmpl)}
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
                                onClick={() => onArtStyleChange(style.id)}
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
                                onClick={() => onAspectChange(opt.ratio)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 씬 개수 선택 (나레이션 모드에서는 숨김) */}
                {mode !== 'narration' && (
                    <div className="idea-settings-section">
                        <div className="idea-settings-label">
                            씬 개수
                            {currentTemplate?.promptRules?.sceneSplitRules?.defaultSceneCount && (
                                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                                    {' '}(템플릿 추천: {currentTemplate.promptRules.sceneSplitRules.defaultSceneCount}개)
                                </span>
                            )}
                        </div>
                        <div className="scene-count-picker" style={{ justifyContent: 'flex-start' }}>
                            <button
                                className="scene-count-btn"
                                onClick={() => onSceneCountChange(Math.max(1, sceneCount - 1))}
                            >
                                <Minus size={12} />
                            </button>
                            <span className="scene-count-value">{sceneCount} scenes</span>
                            <button
                                className="scene-count-btn"
                                onClick={() => onSceneCountChange(Math.min(30, sceneCount + 1))}
                            >
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
                                onClick={onIdeaGenerate}
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
                                onClick={onNarrationScriptSave}
                                disabled={!rawScript.trim()}
                            >
                                다음: 음성 생성 <ArrowRight size={14} />
                            </button>
                        )
                    ) : (
                        inputMode === 'script' ? (
                            <button className="btn-primary" style={{ width: '100%' }} onClick={onGenerateScript}>
                                씬 분할하기 <ArrowRight size={14} />
                            </button>
                        ) : (
                            <button
                                className="btn-primary"
                                style={{ width: '100%' }}
                                onClick={onIdeaGenerate}
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
    );
};

export default IdeaSettingsPanel;
