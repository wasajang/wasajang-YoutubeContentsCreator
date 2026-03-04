/**
 * BlueprintCanvas — Figma Jam 스타일 템플릿 블루프린트 에디터
 *
 * 6개 카드를 워크플로우 순서로 배치하고 화살표로 연결.
 * 각 카드에서 직접 설정값을 입력/선택할 수 있는 인터랙티브 UI.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X, Eye } from 'lucide-react';
import type { Template, TemplateCastCard } from '../../data/templates';
import { artStyles } from '../../data/artStyles';
import { getUserSelectableModels } from '../../data/aiModels';
import { buildImagePrompt, buildVideoPrompt } from '../../services/prompt-builder';

interface BlueprintCanvasProps {
  template: Template;
  onChange: (updated: Template) => void;
  isReadOnly?: boolean;
}

/* ── 공통: 접이식 카드 래퍼 ─────────────────────────────── */

interface CardProps {
  title: string;
  subtitle: string;
  stage: string;
  stageColor: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Card: React.FC<CardProps> = ({ title, subtitle, stage, stageColor, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bp-card">
      <div className="bp-card__header" onClick={() => setOpen(!open)}>
        <span className="bp-card__icon">{icon}</span>
        <div className="bp-card__meta">
          <span className="bp-card__title">{title}</span>
          <span className="bp-card__subtitle">{subtitle}</span>
        </div>
        <span className="bp-card__stage" style={{ background: stageColor }}>{stage}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && <div className="bp-card__body">{children}</div>}
    </div>
  );
};

/* ── 공통: 필드 행 ──────────────────────────────────────── */

const Field: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <div className="bp-field">
    <label className="bp-field__label">
      {label}
      {help && <span className="bp-field__help" title={help}>?</span>}
    </label>
    {children}
  </div>
);

/* ── 메인 컴포넌트 ──────────────────────────────────────── */

const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({ template, onChange, isReadOnly }) => {
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [previewScene, setPreviewScene] = useState('눈보라 속 전사가 검을 들고 서 있다');

  const update = (patch: Partial<Template>) => {
    if (isReadOnly) return;
    onChange({ ...template, ...patch });
  };

  const updateRules = (
    ruleKey: 'imagePromptRules' | 'videoPromptRules',
    field: string,
    value: string | number
  ) => {
    update({
      promptRules: {
        ...template.promptRules,
        [ruleKey]: {
          ...template.promptRules[ruleKey],
          [field]: value,
        },
      },
    });
  };

  const updateSplit = (field: string, value: string | number) => {
    update({
      promptRules: {
        ...template.promptRules,
        sceneSplitRules: {
          ...template.promptRules.sceneSplitRules,
          [field]: value,
        },
      },
    });
  };

  const updateCast = (
    type: 'characters' | 'backgrounds' | 'items',
    cards: TemplateCastCard[]
  ) => {
    update({
      castPreset: {
        ...template.castPreset,
        [type]: cards,
      },
    });
  };

  const addCastCard = (type: 'characters' | 'backgrounds' | 'items') => {
    const newCard: TemplateCastCard = { name: '', description: '', isRequired: false };
    updateCast(type, [...template.castPreset[type], newCard]);
  };

  const removeCastCard = (type: 'characters' | 'backgrounds' | 'items', idx: number) => {
    updateCast(type, template.castPreset[type].filter((_, i) => i !== idx));
  };

  const updateCastCard = (
    type: 'characters' | 'backgrounds' | 'items',
    idx: number,
    field: keyof TemplateCastCard,
    value: string | boolean
  ) => {
    const cards = [...template.castPreset[type]];
    cards[idx] = { ...cards[idx], [field]: value };
    updateCast(type, cards);
  };

  // 프롬프트 미리보기
  const getPromptPreview = () => {
    const ctx = {
      artStyleId: template.artStyleId,
      sceneText: previewScene,
      seedCards: template.castPreset.characters.map((c) => ({
        id: c.name,
        name: c.name,
        type: 'character' as const,
        description: c.description,
        imageUrl: '',
      })).concat(
        template.castPreset.backgrounds.map((b) => ({
          id: b.name,
          name: b.name,
          type: 'background' as const,
          description: b.description,
          imageUrl: '',
        })),
        template.castPreset.items.map((i) => ({
          id: i.name,
          name: i.name,
          type: 'item' as const,
          description: i.description,
          imageUrl: '',
        }))
      ),
      templateId: template.id,
    };
    if (previewType === 'image') return buildImagePrompt(ctx);
    if (previewType === 'video') return buildVideoPrompt(ctx);
    return '';
  };

  const disabled = isReadOnly;

  return (
    <div className="bp-canvas">
      {/* ── Row 1: A → B → C → D ── */}
      <div className="bp-canvas__row">

        {/* A. 프로필 */}
        <Card title="프로필" subtitle="템플릿 기본 정보" stage="전체" stageColor="var(--color-primary)" icon="A">
          <Field label="템플릿 이름">
            <input className="bp-input" value={template.name} disabled={disabled}
              onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="설명">
            <textarea className="bp-textarea bp-textarea--sm" value={template.description} disabled={disabled}
              onChange={(e) => update({ description: e.target.value })} rows={2} />
          </Field>
          <Field label="영상 모드" help="시네마틱(영상 중심) 또는 나레이션(음성 중심)">
            <select className="bp-select" value={template.mode} disabled={disabled}
              onChange={(e) => update({ mode: e.target.value as Template['mode'] })}>
              <option value="cinematic">시네마틱</option>
              <option value="narration">나레이션</option>
            </select>
          </Field>
          <Field label="화면 비율">
            <select className="bp-select" value={template.aspectRatio} disabled={disabled}
              onChange={(e) => update({ aspectRatio: e.target.value as Template['aspectRatio'] })}>
              <option value="16:9">16:9 (가로)</option>
              <option value="9:16">9:16 (세로/쇼츠)</option>
              <option value="1:1">1:1 (정사각)</option>
            </select>
          </Field>
          <Field label="이미지 스타일">
            <select className="bp-select" value={template.artStyleId} disabled={disabled}
              onChange={(e) => update({ artStyleId: e.target.value })}>
              {artStyles.map((s) => (
                <option key={s.id} value={s.id}>{s.nameKo} ({s.name})</option>
              ))}
            </select>
          </Field>
          <Field label="카테고리">
            <input className="bp-input" value={template.category} disabled={disabled}
              onChange={(e) => update({ category: e.target.value })} />
          </Field>
          <Field label="태그">
            <input className="bp-input" value={template.tags.join(', ')} disabled={disabled}
              onChange={(e) => update({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              placeholder="쉼표로 구분" />
          </Field>
          <Field label="난이도">
            <select className="bp-select" value={template.difficulty} disabled={disabled}
              onChange={(e) => update({ difficulty: e.target.value as Template['difficulty'] })}>
              <option value="beginner">초급</option>
              <option value="intermediate">중급</option>
              <option value="advanced">고급</option>
            </select>
          </Field>
          <Field label="공개 상태">
            <select className="bp-select" value={template.visibility} disabled={disabled}
              onChange={(e) => update({ visibility: e.target.value as Template['visibility'] })}>
              <option value="public">공개</option>
              <option value="soon">곧 출시</option>
              <option value="hidden">숨김</option>
            </select>
          </Field>
        </Card>

        {/* 화살표 A→B */}
        <div className="bp-arrow">→</div>

        {/* B. 대본 AI */}
        <Card title="대본 AI" subtitle="대본 생성 규칙" stage="Idea" stageColor="#6366f1" icon="B">
          <Field label="대본 스타일" help="AI가 어떤 톤으로 대본을 쓸지 지시합니다">
            <textarea className="bp-textarea" value={template.promptRules.scriptSystemPrompt} disabled={disabled}
              onChange={(e) => update({
                promptRules: { ...template.promptRules, scriptSystemPrompt: e.target.value }
              })} rows={4} placeholder="예: 당신은 전문 영화 각본가입니다..." />
          </Field>
          <Field label="기본 장면 수">
            <input className="bp-input bp-input--num" type="number" min={1} max={50}
              value={template.promptRules.sceneSplitRules.defaultSceneCount} disabled={disabled}
              onChange={(e) => updateSplit('defaultSceneCount', parseInt(e.target.value) || 8)} />
          </Field>
          <div className="bp-field-row">
            <Field label="최소">
              <input className="bp-input bp-input--num" type="number" min={1}
                value={template.promptRules.sceneSplitRules.minSceneCount} disabled={disabled}
                onChange={(e) => updateSplit('minSceneCount', parseInt(e.target.value) || 3)} />
            </Field>
            <Field label="최대">
              <input className="bp-input bp-input--num" type="number" min={1}
                value={template.promptRules.sceneSplitRules.maxSceneCount} disabled={disabled}
                onChange={(e) => updateSplit('maxSceneCount', parseInt(e.target.value) || 20)} />
            </Field>
          </div>
          <Field label="장면당 길이(초)">
            <input className="bp-input bp-input--num" type="number" min={1}
              value={template.promptRules.sceneSplitRules.targetDurationPerScene} disabled={disabled}
              onChange={(e) => updateSplit('targetDurationPerScene', parseInt(e.target.value) || 5)} />
          </Field>
          <Field label="대본 AI 모델">
            <select className="bp-select" value={template.defaultModels.script} disabled={disabled}
              onChange={(e) => update({ defaultModels: { ...template.defaultModels, script: e.target.value } })}>
              {getUserSelectableModels('script').map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="예시 아이디어">
            <textarea className="bp-textarea bp-textarea--sm" value={template.sampleIdea || ''} disabled={disabled}
              onChange={(e) => update({ sampleIdea: e.target.value })} rows={2}
              placeholder="이 템플릿으로 만들 수 있는 영상 아이디어 예시" />
          </Field>
        </Card>

        {/* 화살표 B→C */}
        <div className="bp-arrow">→</div>

        {/* C. 캐스트 */}
        <Card title="캐스트" subtitle="등장인물 / 배경 / 소품" stage="Storyboard" stageColor="#f59e0b" icon="C">
          {(['characters', 'backgrounds', 'items'] as const).map((type) => {
            const label = type === 'characters' ? '캐릭터' : type === 'backgrounds' ? '배경' : '소품';
            const cards = template.castPreset[type];
            return (
              <div key={type} className="bp-cast-group">
                <div className="bp-cast-group__header">
                  <span>{label} ({cards.length})</span>
                  {!disabled && (
                    <button className="bp-btn-sm" onClick={() => addCastCard(type)}>
                      <Plus size={12} /> 추가
                    </button>
                  )}
                </div>
                {cards.map((card, idx) => (
                  <div key={idx} className="bp-cast-card">
                    <div className="bp-cast-card__top">
                      <input className="bp-input bp-input--sm" value={card.name} disabled={disabled}
                        onChange={(e) => updateCastCard(type, idx, 'name', e.target.value)}
                        placeholder="이름" />
                      <label className="bp-cast-card__req">
                        <input type="checkbox" checked={card.isRequired} disabled={disabled}
                          onChange={(e) => updateCastCard(type, idx, 'isRequired', e.target.checked)} />
                        필수
                      </label>
                      {!disabled && (
                        <button className="bp-btn-icon" onClick={() => removeCastCard(type, idx)}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <textarea className="bp-textarea bp-textarea--xs" value={card.description} disabled={disabled}
                      onChange={(e) => updateCastCard(type, idx, 'description', e.target.value)}
                      placeholder="AI 프롬프트에 들어갈 설명 (영문 권장)" rows={2} />
                  </div>
                ))}
              </div>
            );
          })}
        </Card>

        {/* 화살표 C→D */}
        <div className="bp-arrow">→</div>

        {/* D. 이미지 AI */}
        <Card title="이미지 AI" subtitle="이미지 프롬프트 규칙" stage="Generate" stageColor="#10b981" icon="D">
          <Field label="이미지 분위기" help="모든 이미지에 적용될 기본 스타일 키워드">
            <textarea className="bp-textarea" value={template.promptRules.imagePromptRules.prefix} disabled={disabled}
              onChange={(e) => updateRules('imagePromptRules', 'prefix', e.target.value)} rows={3}
              placeholder="예: photorealistic cinematic still, 4K, dramatic lighting" />
          </Field>
          <Field label="이미지 마무리" help="이미지 끝에 붙는 품질 지시">
            <textarea className="bp-textarea bp-textarea--sm" value={template.promptRules.imagePromptRules.suffix} disabled={disabled}
              onChange={(e) => updateRules('imagePromptRules', 'suffix', e.target.value)} rows={2} />
          </Field>
          <Field label="제외할 요소" help="이미지에 나오면 안 되는 것">
            <textarea className="bp-textarea bp-textarea--sm" value={template.promptRules.imagePromptRules.negativePrompt} disabled={disabled}
              onChange={(e) => updateRules('imagePromptRules', 'negativePrompt', e.target.value)} rows={2}
              placeholder="예: blurry, low quality, watermark" />
          </Field>
          <Field label="세부 연출" help="추가 연출 지시사항">
            <textarea className="bp-textarea bp-textarea--sm" value={template.promptRules.imagePromptRules.instruction} disabled={disabled}
              onChange={(e) => updateRules('imagePromptRules', 'instruction', e.target.value)} rows={3} />
          </Field>
          <Field label="이미지 AI 모델">
            <select className="bp-select" value={template.defaultModels.image} disabled={disabled}
              onChange={(e) => update({ defaultModels: { ...template.defaultModels, image: e.target.value } })}>
              {getUserSelectableModels('image').map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <button className="bp-btn-preview" onClick={() => setPreviewType(previewType === 'image' ? null : 'image')}>
            <Eye size={14} /> 프롬프트 미리보기
          </button>
        </Card>
      </div>

      {/* ── Row 2: F ← E ── */}
      <div className="bp-canvas__row bp-canvas__row--bottom">
        <div className="bp-spacer" />
        <div className="bp-spacer" />

        {/* F. 음성 */}
        <Card title="음성" subtitle="TTS 설정" stage="Timeline" stageColor="#8b5cf6" icon="F" defaultOpen={false}>
          <Field label="음성 톤" help="어떤 느낌의 목소리인지 설명">
            <input className="bp-input" value={template.voice?.tone || ''} disabled={disabled}
              onChange={(e) => update({ voice: { ...template.voice, tone: e.target.value } })}
              placeholder="예: 웅장하고 서사적인" />
          </Field>
          <Field label="읽기 속도">
            <input className="bp-input bp-input--num" type="number" min={0.5} max={2.0} step={0.1}
              value={template.voice?.speed ?? 1.0} disabled={disabled}
              onChange={(e) => update({ voice: { ...template.voice, speed: parseFloat(e.target.value) || 1.0 } })} />
          </Field>
          <Field label="TTS 모델">
            <select className="bp-select" value={template.defaultModels.tts} disabled={disabled}
              onChange={(e) => update({ defaultModels: { ...template.defaultModels, tts: e.target.value } })}>
              {getUserSelectableModels('tts').map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
        </Card>

        {/* 화살표 E→F */}
        <div className="bp-arrow">←</div>

        {/* E. 영상 AI */}
        <Card title="영상 AI" subtitle="영상 프롬프트 규칙" stage="Generate" stageColor="#10b981" icon="E" defaultOpen={false}>
          <Field label="카메라 연출" help="영상에 적용할 기본 카메라/연출 스타일">
            <textarea className="bp-textarea" value={template.promptRules.videoPromptRules.prefix} disabled={disabled}
              onChange={(e) => updateRules('videoPromptRules', 'prefix', e.target.value)} rows={3}
              placeholder="예: cinematic camera movement, slow motion" />
          </Field>
          <Field label="영상 길이(초)">
            <input className="bp-input bp-input--num" type="number" min={1} max={30}
              value={template.promptRules.videoPromptRules.defaultDuration} disabled={disabled}
              onChange={(e) => updateRules('videoPromptRules', 'defaultDuration', parseInt(e.target.value) || 5)} />
          </Field>
          <Field label="세부 연출">
            <textarea className="bp-textarea bp-textarea--sm" value={template.promptRules.videoPromptRules.instruction} disabled={disabled}
              onChange={(e) => updateRules('videoPromptRules', 'instruction', e.target.value)} rows={3} />
          </Field>
          <Field label="영상 AI 모델">
            <select className="bp-select" value={template.defaultModels.video} disabled={disabled}
              onChange={(e) => update({ defaultModels: { ...template.defaultModels, video: e.target.value } })}>
              {getUserSelectableModels('video').map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>
          <button className="bp-btn-preview" onClick={() => setPreviewType(previewType === 'video' ? null : 'video')}>
            <Eye size={14} /> 프롬프트 미리보기
          </button>
        </Card>
      </div>

      {/* ── 프롬프트 미리보기 패널 ── */}
      {previewType && (
        <div className="bp-preview">
          <div className="bp-preview__header">
            <span>{previewType === 'image' ? '이미지' : '영상'} 프롬프트 미리보기</span>
            <button className="bp-btn-icon" onClick={() => setPreviewType(null)}><X size={14} /></button>
          </div>
          <Field label="테스트 장면">
            <input className="bp-input" value={previewScene}
              onChange={(e) => setPreviewScene(e.target.value)}
              placeholder="테스트할 장면 설명을 입력하세요" />
          </Field>
          <div className="bp-preview__result">
            <pre>{getPromptPreview()}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlueprintCanvas;
