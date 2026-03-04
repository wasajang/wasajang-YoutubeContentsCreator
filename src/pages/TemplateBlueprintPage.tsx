/**
 * TemplateBlueprintPage — 템플릿 블루프린트 에디터 페이지
 *
 * Figma Jam 스타일 워크플로우 시각화 + 인라인 편집
 * 공식 템플릿 편집(오버라이드) + 커스텀 템플릿 CRUD
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Copy, Trash2, Plus, Check, RotateCcw } from 'lucide-react';
import { templates as officialTemplates, getTemplateById } from '../data/templates';
import type { Template } from '../data/templates';
import {
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  saveTemplateOverride,
  resetTemplateOverride,
  cloneTemplate,
  createBlankTemplate,
  migrateLegacyOverrides,
} from '../services/template-store';
import BlueprintCanvas from '../components/blueprint/BlueprintCanvas';

const TemplateBlueprintPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // 마이그레이션 (1회성)
  useEffect(() => { migrateLegacyOverrides(); }, []);

  // 모든 템플릿 목록 (공식 + 커스텀)
  const [customTemplates, setCustomTemplates] = useState<Template[]>(getCustomTemplates());
  const allTemplates = [...officialTemplates, ...customTemplates];

  // 현재 편집 중인 템플릿
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  // URL 파라미터로 템플릿 로드
  useEffect(() => {
    if (id === 'new') {
      const blank = createBlankTemplate('cinematic');
      setEditingTemplate(blank);
      setHasChanges(true);
    } else if (id) {
      const tmpl = getTemplateById(id);
      if (tmpl) {
        setEditingTemplate({ ...tmpl });
      }
    } else if (allTemplates.length > 0) {
      setEditingTemplate({ ...getTemplateById(allTemplates[0].id) || allTemplates[0] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSelectTemplate = (tmplId: string) => {
    if (hasChanges && !confirm('저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?')) return;
    navigate(`/templates/blueprint/${tmplId}`, { replace: true });
    const tmpl = getTemplateById(tmplId);
    if (tmpl) {
      setEditingTemplate({ ...tmpl });
      setHasChanges(false);
    }
  };

  const handleChange = useCallback((updated: Template) => {
    setEditingTemplate(updated);
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    if (!editingTemplate) return;

    if (editingTemplate.isOfficial) {
      // 공식 템플릿 → 오버라이드 저장
      const original = officialTemplates.find((t) => t.id === editingTemplate.id);
      if (original) {
        const override: Partial<Template> = {};
        // 변경된 필드만 오버라이드에 포함
        for (const key of Object.keys(editingTemplate) as (keyof Template)[]) {
          if (JSON.stringify(editingTemplate[key]) !== JSON.stringify(original[key])) {
            (override as Record<string, unknown>)[key] = editingTemplate[key];
          }
        }
        saveTemplateOverride(editingTemplate.id, override);
      }
    } else {
      // 커스텀 템플릿 → 직접 저장
      saveCustomTemplate(editingTemplate);
      setCustomTemplates(getCustomTemplates());
    }

    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!editingTemplate?.isOfficial) return;
    if (!confirm('원본으로 되돌리시겠습니까?')) return;
    resetTemplateOverride(editingTemplate.id);
    const original = officialTemplates.find((t) => t.id === editingTemplate.id);
    if (original) {
      setEditingTemplate({ ...original });
      setHasChanges(false);
    }
  };

  const handleClone = () => {
    if (!editingTemplate) return;
    const name = prompt('새 템플릿 이름:', `${editingTemplate.name} (복사본)`);
    if (!name) return;
    const cloned = cloneTemplate(editingTemplate, name);
    saveCustomTemplate(cloned);
    setCustomTemplates(getCustomTemplates());
    navigate(`/templates/blueprint/${cloned.id}`, { replace: true });
    setEditingTemplate(cloned);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (!editingTemplate || editingTemplate.isOfficial) return;
    if (!confirm(`'${editingTemplate.name}' 템플릿을 삭제하시겠습니까?`)) return;
    deleteCustomTemplate(editingTemplate.id);
    setCustomTemplates(getCustomTemplates());
    navigate('/templates/blueprint', { replace: true });
    setEditingTemplate(null);
    setHasChanges(false);
  };

  const handleNewTemplate = (mode: 'cinematic' | 'narration') => {
    const blank = createBlankTemplate(mode);
    saveCustomTemplate(blank);
    setCustomTemplates(getCustomTemplates());
    navigate(`/templates/blueprint/${blank.id}`, { replace: true });
    setEditingTemplate(blank);
    setHasChanges(true);
  };

  return (
    <div className="bp-page">
      {/* ── 헤더 ── */}
      <div className="bp-page__header">
        <div className="bp-page__header-left">
          <button className="bp-btn-ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> 뒤로
          </button>
          <h1 className="bp-page__title">Template Blueprint</h1>
        </div>
        <div className="bp-page__header-right">
          {editingTemplate && (
            <>
              {editingTemplate.isOfficial && (
                <button className="bp-btn-ghost" onClick={handleReset} title="원본으로 복원">
                  <RotateCcw size={14} /> 리셋
                </button>
              )}
              <button className="bp-btn-ghost" onClick={handleClone} title="이 템플릿을 복제">
                <Copy size={14} /> 복제
              </button>
              {!editingTemplate.isOfficial && (
                <button className="bp-btn-ghost bp-btn-ghost--danger" onClick={handleDelete}>
                  <Trash2 size={14} /> 삭제
                </button>
              )}
              <button className="bp-btn-primary" onClick={handleSave} disabled={!hasChanges}>
                {saved ? <><Check size={14} /> 저장됨</> : <><Save size={14} /> 저장</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 템플릿 목록 (가로 칩) ── */}
      <div className="bp-page__tabs">
        <div className="bp-page__tabs-label">템플릿:</div>
        <div className="bp-page__tabs-list">
          {/* 공식 */}
          {officialTemplates.map((t) => (
            <button
              key={t.id}
              className={`bp-tab ${editingTemplate?.id === t.id ? 'bp-tab--active' : ''}`}
              onClick={() => handleSelectTemplate(t.id)}
            >
              <span className="bp-tab__badge bp-tab__badge--official">공식</span>
              {t.name}
            </button>
          ))}
          {/* 커스텀 */}
          {customTemplates.map((t) => (
            <button
              key={t.id}
              className={`bp-tab ${editingTemplate?.id === t.id ? 'bp-tab--active' : ''}`}
              onClick={() => handleSelectTemplate(t.id)}
            >
              <span className="bp-tab__badge bp-tab__badge--custom">MY</span>
              {t.name}
            </button>
          ))}
          {/* 새 템플릿 드롭다운 */}
          <div className="bp-new-dropdown">
            <button className="bp-tab bp-tab--new">
              <Plus size={14} /> 새 템플릿
            </button>
            <div className="bp-new-dropdown__menu">
              <button onClick={() => handleNewTemplate('cinematic')}>시네마틱 템플릿</button>
              <button onClick={() => handleNewTemplate('narration')}>나레이션 템플릿</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 블루프린트 캔버스 ── */}
      {editingTemplate ? (
        <BlueprintCanvas
          template={editingTemplate}
          onChange={handleChange}
        />
      ) : (
        <div className="bp-empty">
          좌측에서 템플릿을 선택하거나 새 템플릿을 만들어주세요.
        </div>
      )}
    </div>
  );
};

export default TemplateBlueprintPage;
