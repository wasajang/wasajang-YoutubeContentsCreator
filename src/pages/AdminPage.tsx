/**
 * AdminPage — Dev 전용 관리 패널
 *
 * 접근 제어: ADMIN_EMAILS에 포함된 계정만 접근 가능
 * 기능: 프롬프트 템플릿 관리, 스타일 프리셋 공개 상태, AI 모델 설정, 시스템 현황
 */
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Settings2, FileText, Palette, Bot, BarChart2, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { stylePresets } from '../data/stylePresets';
import type { StylePreset } from '../data/stylePresets';
import { getPromptBuilderModels } from '../data/aiModels';

const ADMIN_EMAILS = ['wofou7@gmail.com'];

type VisibilityKey = StylePreset['visibility'];
const VISIBILITY_OPTIONS: { value: VisibilityKey; label: string; color: string }[] = [
    { value: 'public', label: '공개',    color: '#10b981' },
    { value: 'soon',   label: '곧 출시', color: '#f59e0b' },
    { value: 'hidden', label: '숨김',    color: '#6b7280' },
];

/* ── 프롬프트 템플릿 초기값 ─────────────────────────── */
const DEFAULT_PROMPTS = {
    script: '당신은 전문 YouTube 영상 스크립트 작가입니다.\n씬 번호, 대사, 행동 지시를 포함하여 작성하세요.',
    image:  'photorealistic, 8K, cinematic lighting, ultra-detailed, sharp focus,',
    video:  'cinematic camera movement, smooth transition, 24fps film look,',
    tts:    '자연스럽고 감정이 담긴 목소리로 읽어주세요. 속도: 보통.',
};

/* ── 저장 상태 표시 훅 ──────────────────────────────── */
function useSaveState() {
    const [saved, setSaved] = useState(false);
    const triggerSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };
    return { saved, triggerSave };
}

const AdminPage: React.FC = () => {
    const { user } = useAuth();

    /* 접근 제어 */
    if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
        return <Navigate to="/" replace />;
    }

    /* 프롬프트 템플릿 상태 */
    const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
    const { saved: promptSaved, triggerSave: savePrompt } = useSaveState();

    /* 프리셋 visibility 상태 (초기값 = stylePresets.ts 데이터) */
    const [presetVisibility, setPresetVisibility] = useState<Record<string, VisibilityKey>>(
        Object.fromEntries(stylePresets.map((p) => [p.id, p.visibility]))
    );
    const { saved: presetSaved, triggerSave: savePreset } = useSaveState();

    /* 프롬프트 생성 AI 모델 (내부 전용) */
    const promptBuilderModels = getPromptBuilderModels();
    const [promptModel, setPromptModel] = useState(
        promptBuilderModels.find((m) => m.isDefault)?.id ?? promptBuilderModels[0]?.id ?? ''
    );
    const { saved: modelSaved, triggerSave: saveModel } = useSaveState();

    return (
        <div className="page-container admin-page">
            <div className="admin-header">
                <Settings2 size={20} />
                <h2 className="admin-header__title">Admin Panel</h2>
                <span className="admin-header__badge">Dev Only</span>
            </div>

            <div className="admin-body">
                {/* ── 1. 프롬프트 템플릿 관리 ── */}
                <section className="admin-section">
                    <div className="admin-section__head">
                        <FileText size={15} />
                        <h3>프롬프트 템플릿</h3>
                    </div>

                    {(['script', 'image', 'video', 'tts'] as const).map((key) => (
                        <div key={key} className="admin-prompt-row">
                            <label className="admin-prompt-row__label">
                                {{ script: '📝 대본 생성', image: '🖼 이미지 생성', video: '🎬 영상 생성', tts: '🔊 TTS 음성' }[key]}
                            </label>
                            <textarea
                                className="admin-textarea"
                                rows={3}
                                value={prompts[key]}
                                onChange={(e) => setPrompts((p) => ({ ...p, [key]: e.target.value }))}
                            />
                        </div>
                    ))}

                    <div className="admin-section__foot">
                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={savePrompt}>
                            {promptSaved ? <><CheckCircle2 size={14} /> 저장됨</> : <><Save size={14} /> 저장</>}
                        </button>
                        {promptSaved && <span className="admin-saved-note">변경사항이 저장되었습니다.</span>}
                    </div>
                </section>

                {/* ── 2. 스타일 프리셋 관리 ── */}
                <section className="admin-section">
                    <div className="admin-section__head">
                        <Palette size={15} />
                        <h3>스타일 프리셋 관리</h3>
                        <span className="admin-section__count">{stylePresets.length}개</span>
                    </div>

                    <div className="admin-preset-grid">
                        {stylePresets.map((preset) => {
                            const vis = presetVisibility[preset.id] ?? preset.visibility;
                            const opt = VISIBILITY_OPTIONS.find((o) => o.value === vis)!;
                            return (
                                <div key={preset.id} className="admin-preset-card">
                                    {preset.thumbnail && (
                                        <img src={preset.thumbnail} className="admin-preset-card__img" alt={preset.name} />
                                    )}
                                    <div className="admin-preset-card__info">
                                        <span className="admin-preset-card__name">{preset.name}</span>
                                        <span className="admin-preset-card__cat">{preset.category}</span>
                                    </div>
                                    <select
                                        className="admin-preset-select"
                                        style={{ color: opt.color }}
                                        value={vis}
                                        onChange={(e) => setPresetVisibility((prev) => ({ ...prev, [preset.id]: e.target.value as VisibilityKey }))}
                                    >
                                        {VISIBILITY_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>

                    <div className="admin-section__foot">
                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={savePreset}>
                            {presetSaved ? <><CheckCircle2 size={14} /> 저장됨</> : <><Save size={14} /> 저장</>}
                        </button>
                        {presetSaved && <span className="admin-saved-note">변경사항이 저장되었습니다.</span>}
                    </div>
                </section>

                {/* ── 3. AI 모델 설정 (내부 전용) ── */}
                <section className="admin-section">
                    <div className="admin-section__head">
                        <Bot size={15} />
                        <h3>AI 모델 설정</h3>
                    </div>

                    <div className="admin-model-row">
                        <div className="admin-model-row__label">
                            <span>🔒 프롬프트 생성 AI</span>
                            <span className="admin-model-row__note">내부 전용 — 사용자에게 노출 안 됨</span>
                        </div>
                        <select
                            className="admin-select"
                            value={promptModel}
                            onChange={(e) => setPromptModel(e.target.value)}
                        >
                            {promptBuilderModels.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <p className="admin-model-note">
                        사용자 옵션(스타일, 캐스트, 씬 대본)을 받아 이미지/영상/대본 AI에 전달할 최적화 프롬프트를 자동 생성합니다.
                        크레딧 차감 없음 (플랫폼 내부 비용).
                    </p>

                    <div className="admin-section__foot">
                        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={saveModel}>
                            {modelSaved ? <><CheckCircle2 size={14} /> 저장됨</> : <><Save size={14} /> 저장</>}
                        </button>
                    </div>
                </section>

                {/* ── 4. 시스템 현황 ── */}
                <section className="admin-section">
                    <div className="admin-section__head">
                        <BarChart2 size={15} />
                        <h3>시스템 현황</h3>
                        <span className="admin-section__count" style={{ color: 'var(--text-muted)' }}>Mock 데이터</span>
                    </div>

                    <div className="admin-stats-grid">
                        {[
                            { label: '총 사용자',      value: '—',    unit: '명' },
                            { label: '오늘 생성 이미지', value: '—',  unit: '개' },
                            { label: '오늘 생성 영상',  value: '—',   unit: '개' },
                            { label: '오늘 크레딧 소비', value: '—',  unit: '크레딧' },
                        ].map((stat) => (
                            <div key={stat.label} className="admin-stat-card">
                                <div className="admin-stat-card__value">{stat.value}</div>
                                <div className="admin-stat-card__unit">{stat.unit}</div>
                                <div className="admin-stat-card__label">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminPage;
