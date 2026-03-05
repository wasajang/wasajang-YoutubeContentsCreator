import React from 'react';
import { Pencil, Check, RotateCcw, FileText } from 'lucide-react';
import type { Scene } from '../../store/projectStore';

export interface IdeaResultPanelProps {
    scenes: Scene[];
    isGenerated: boolean;
    editingSceneId: string | null;
    editingText: string;
    onEditScene: (id: string, text: string) => void;
    onSaveEdit: () => void;
    onEditingTextChange: (text: string) => void;
    onCancelEdit: () => void;
    onToggleSceneCheck: (id: string) => void;
    onReset: () => void;
}

const IdeaResultPanel: React.FC<IdeaResultPanelProps> = ({
    scenes,
    isGenerated,
    editingSceneId,
    editingText,
    onEditScene,
    onSaveEdit,
    onEditingTextChange,
    onCancelEdit,
    onToggleSceneCheck,
    onReset,
}) => {
    return (
        <div className="idea-layout__result">
            <div className="idea-col-header idea-col-header--result">
                <h3 className="idea-col-title">3. 결과 확인</h3>
                {isGenerated && (
                    <button className="btn-secondary script-reset-btn" onClick={onReset}>
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
                                        onChange={(e) => onEditingTextChange(e.target.value)}
                                        onBlur={onSaveEdit}
                                        onKeyDown={(e) => e.key === 'Escape' && onCancelEdit()}
                                        autoFocus
                                    />
                                ) : (
                                    <p className="script-editor__scene-text">{scene.text}</p>
                                )}
                                <div className="script-scene-actions">
                                    <button
                                        className="btn-icon"
                                        title="편집"
                                        onClick={() => onEditScene(scene.id, scene.text)}
                                    >
                                        <Pencil size={13} />
                                    </button>
                                    <div
                                        className={`script-editor__scene-check ${scene.checked ? 'checked' : ''}`}
                                        onClick={() => onToggleSceneCheck(scene.id)}
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
    );
};

export default IdeaResultPanel;
