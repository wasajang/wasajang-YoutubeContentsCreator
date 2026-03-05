import React from 'react';
import { Wand2 } from 'lucide-react';
import type { AiModelPreferences } from '../../store/projectStore';
import type { ProjectMode } from '../../store/projectStore';
import { getUserSelectableModels } from '../../data/aiModels';

export type InputMode = 'script' | 'idea';

export interface ScriptInputPanelProps {
    inputMode: InputMode;
    rawScript: string;
    ideaText: string;
    sceneCount: number;
    mode: ProjectMode;
    aiModelPreferences: AiModelPreferences;
    currentTemplateSampleIdea?: string;
    onInputModeChange: (mode: InputMode) => void;
    onRawScriptChange: (value: string) => void;
    onIdeaTextChange: (value: string) => void;
    onAiModelPreferenceChange: (category: 'script' | 'image' | 'video' | 'tts', modelId: string) => void;
}

const ScriptInputPanel: React.FC<ScriptInputPanelProps> = ({
    inputMode,
    rawScript,
    ideaText,
    sceneCount,
    mode,
    aiModelPreferences,
    currentTemplateSampleIdea,
    onInputModeChange,
    onRawScriptChange,
    onIdeaTextChange,
    onAiModelPreferenceChange,
}) => {
    return (
        <div className="idea-layout__script">
            <div className="idea-col-header">
                <h3 className="idea-col-title">1. 대본 작성</h3>
            </div>

            {/* 입력 모드 탭 */}
            <div className="script-input-tabs" style={{ padding: '0 16px', marginBottom: 0 }}>
                <button
                    className={`script-input-tab ${inputMode === 'idea' ? 'active' : ''}`}
                    onClick={() => onInputModeChange('idea')}
                >
                    <Wand2 size={13} /> 아이디어 입력
                </button>
                <button
                    className={`script-input-tab ${inputMode === 'script' ? 'active' : ''}`}
                    onClick={() => onInputModeChange('script')}
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
                        onChange={(e) => onRawScriptChange(e.target.value)}
                    />
                ) : (
                    <textarea
                        className="script-textarea idea-textarea"
                        placeholder={currentTemplateSampleIdea || `영상의 아이디어나 줄거리를 자유롭게 입력하세요.\n\n예시: "1950년대 한국전쟁 중 미래에서 온 현대 군대가 타임포털을 통해 나타나 전세를 바꾼다."`}
                        value={ideaText}
                        onChange={(e) => onIdeaTextChange(e.target.value)}
                    />
                )}
            </div>

            {/* 씬 이미지 시각화 */}
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
                            onChange={(e) => onAiModelPreferenceChange('script', e.target.value)}
                        >
                            {getUserSelectableModels('script').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptInputPanel;
