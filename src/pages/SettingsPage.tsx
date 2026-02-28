/**
 * SettingsPage — 크레딧, 구독 플랜, BYOK API 키, 계정 설정
 */
import React, { useState } from 'react';
import { Settings, Key, CreditCard, User, Eye, EyeOff, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';
import { useSettingsStore, type ApiProvider } from '../store/settingsStore';
import { CREDIT_COST_TABLE } from '../data/creditCosts';
import { useAuth } from '../hooks/useAuth';

const API_PROVIDERS: { key: ApiProvider; label: string; placeholder: string; action: string }[] = [
    { key: 'openai',      label: 'OpenAI',       placeholder: 'sk-...',       action: 'script' },
    { key: 'replicate',   label: 'Replicate',    placeholder: 'r8_...',       action: 'image' },
    { key: 'runway',      label: 'Runway',       placeholder: 'rw_...',       action: 'video' },
    { key: 'fishSpeech',  label: 'Fish Speech',  placeholder: 'fs_...',       action: 'tts' },
];

const COST_ROWS = [
    { label: '대본 생성',  action: 'script' },
    { label: '이미지 생성', action: 'image' },
    { label: '영상 생성',  action: 'video' },
    { label: 'TTS 음성',  action: 'tts' },
    { label: '카드 생성',  action: 'card' },
];

const ApiKeyRow: React.FC<{ provider: typeof API_PROVIDERS[0] }> = ({ provider }) => {
    const { apiKeys, setApiKey, removeApiKey, hasApiKey } = useSettingsStore();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [showKey, setShowKey] = useState(false);

    const currentKey = apiKeys[provider.key] ?? '';
    const hasKey = hasApiKey(provider.key);

    const handleSave = () => {
        if (draft.trim()) {
            setApiKey(provider.key, draft.trim());
        }
        setEditing(false);
        setDraft('');
    };

    const handleRemove = () => {
        removeApiKey(provider.key);
        setEditing(false);
    };

    const maskedKey = currentKey.length > 8
        ? `${currentKey.slice(0, 4)}****${currentKey.slice(-4)}`
        : '****';

    return (
        <div className="settings-api-row">
            <div className="settings-api-row__label">
                <span className="settings-api-row__name">{provider.label}</span>
                {hasKey && (
                    <span className="settings-api-badge settings-api-badge--active">BYOK 활성</span>
                )}
            </div>
            {editing ? (
                <div className="settings-api-row__edit">
                    <input
                        className="settings-input"
                        type={showKey ? 'text' : 'password'}
                        placeholder={provider.placeholder}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                    />
                    <button className="btn-icon" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '4px 12px' }} onClick={handleSave}>저장</button>
                    <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }} onClick={() => setEditing(false)}>취소</button>
                </div>
            ) : (
                <div className="settings-api-row__view">
                    {hasKey ? (
                        <>
                            <span className="settings-api-row__key">{maskedKey}</span>
                            <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '3px 10px' }} onClick={() => { setDraft(currentKey); setEditing(true); }}>수정</button>
                            <button className="btn-icon settings-api-row__delete" onClick={handleRemove}><Trash2 size={13} /></button>
                        </>
                    ) : (
                        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setEditing(true)}>
                            <Plus size={12} /> 추가
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const SettingsPage: React.FC = () => {
    const { remaining, addCredits } = useCredits();
    const { user } = useAuth();
    const { apiKeys } = useSettingsStore();
    const activeByokCount = Object.values(apiKeys).filter(Boolean).length;

    return (
        <div className="page-container settings-page">
            <div className="settings-header">
                <Settings size={20} />
                <h2 className="settings-header__title">Settings</h2>
            </div>

            <div className="settings-body">
                {/* 크레딧 섹션 */}
                <section className="settings-section">
                    <div className="settings-section__head">
                        <CreditCard size={16} />
                        <h3>크레딧</h3>
                    </div>
                    <div className="settings-credit-info">
                        <div className="settings-credit-balance">
                            <span className="settings-credit-balance__num">{remaining}</span>
                            <span className="settings-credit-balance__label">크레딧 잔액</span>
                        </div>
                        <button
                            className="btn-primary"
                            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
                            onClick={() => addCredits(100)}
                        >
                            + 100 크레딧 충전 (테스트)
                        </button>
                    </div>

                    {/* 구독 플랜 */}
                    <div className="settings-plans">
                        {[
                            { name: 'Free',       credits: 100,   price: '무료',      current: true  },
                            { name: 'Pro',        credits: 1000,  price: '₩19,900/월', current: false },
                            { name: 'Enterprise', credits: 5000,  price: '₩99,000/월', current: false },
                        ].map((plan) => (
                            <div key={plan.name} className={`settings-plan-card ${plan.current ? 'settings-plan-card--current' : ''}`}>
                                <div className="settings-plan-card__name">{plan.name}</div>
                                <div className="settings-plan-card__credits">{plan.credits.toLocaleString()} 크레딧/월</div>
                                <div className="settings-plan-card__price">{plan.price}</div>
                                {plan.current ? (
                                    <span className="settings-plan-card__badge">현재 플랜</span>
                                ) : (
                                    <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 10px', marginTop: 8 }}>업그레이드</button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* 크레딧 비용 안내 */}
                <section className="settings-section">
                    <div className="settings-section__head">
                        <CreditCard size={16} />
                        <h3>크레딧 비용 안내</h3>
                        {activeByokCount > 0 && (
                            <span className="settings-api-badge settings-api-badge--active" style={{ marginLeft: 'auto' }}>
                                BYOK {activeByokCount}개 활성
                            </span>
                        )}
                    </div>
                    <table className="settings-cost-table">
                        <thead>
                            <tr>
                                <th>작업</th>
                                <th>기본 비용</th>
                                <th>BYOK 비용</th>
                                <th>절약</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COST_ROWS.map(({ label, action }) => {
                                const cost = CREDIT_COST_TABLE[action];
                                if (!cost) return null;
                                return (
                                    <tr key={action}>
                                        <td>{label}</td>
                                        <td>{cost.total} 크레딧</td>
                                        <td className="settings-cost-table__byok">{cost.totalByok} 크레딧</td>
                                        <td className="settings-cost-table__save">-{cost.apiCost} 크레딧</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="settings-byok-note">
                        <AlertTriangle size={12} />
                        BYOK: 본인 API 키 사용 시 AI 비용 면제, 플랫폼 이용료만 차감됩니다.
                    </p>
                </section>

                {/* BYOK API 키 섹션 */}
                <section className="settings-section">
                    <div className="settings-section__head">
                        <Key size={16} />
                        <h3>API 키 (BYOK)</h3>
                    </div>
                    <div className="settings-api-list">
                        {API_PROVIDERS.map((p) => (
                            <ApiKeyRow key={p.key} provider={p} />
                        ))}
                    </div>
                    <p className="settings-byok-note">
                        <AlertTriangle size={12} />
                        API 키는 이 브라우저에만 저장됩니다. 타인과 공유하지 마세요.
                    </p>
                </section>

                {/* 계정 섹션 */}
                <section className="settings-section">
                    <div className="settings-section__head">
                        <User size={16} />
                        <h3>계정</h3>
                    </div>
                    {user ? (
                        <div className="settings-account-info">
                            <div className="settings-account-row">
                                <span className="settings-account-row__label">이메일</span>
                                <span className="settings-account-row__value">{user.email}</span>
                            </div>
                            <div className="settings-account-row">
                                <span className="settings-account-row__label">로그인 방식</span>
                                <span className="settings-account-row__value">
                                    {user.app_metadata?.provider === 'google' ? 'Google' :
                                     user.app_metadata?.provider === 'kakao'  ? 'Kakao'  : '이메일'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            로그인 후 계정 정보를 확인할 수 있습니다.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default SettingsPage;
