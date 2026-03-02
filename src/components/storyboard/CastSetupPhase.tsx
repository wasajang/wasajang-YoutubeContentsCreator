/**
 * CastSetupPhase — 스토리보드 2단계: 촬영 카드 선택 단계 UI
 *
 * cast-setup 단계 전체를 렌더링합니다.
 * 왼쪽: DeckPanel (내 덱), 오른쪽: 카드 풀 (탭별 그리드)
 */
import React from 'react';
import {
    Sparkles, Star, Shield, User, MapPin, Sword,
    Plus, X, Hash, CheckCircle2, ArrowRight,
} from 'lucide-react';
import type { AssetCard } from '../../store/projectStore';
import type { UseDeckApi } from '../../hooks/useDeck';
import { MAX_AI_SLOTS, MAX_MANUAL_SLOTS, MAX_DECK_SIZE } from '../../hooks/useDeck';
import DeckPanel from './DeckPanel';
import AiAnalysisModal from './AiAnalysisModal';

interface CastSetupPhaseProps {
    deckApi: UseDeckApi;
    showAiAnalysisModal: boolean;
    isAiAnalyzing: boolean;
    onAiAnalysis: (doAnalysis: boolean) => void;
    onNextPhase: () => void;
    /** 나레이션 모드에서 이전 스텝(Step 3)으로 돌아갈 때 사용 */
    onPrevPhase?: () => void;
    /** 다음 버튼 레이블 (기본값: "다음: 컷 분할") */
    nextLabel?: string;
    /** 템플릿 분기용 */
    templateId?: string | null;
    templateName?: string;
    castPreset?: { characters: Array<{ name: string; description?: string }>; backgrounds: Array<{ name: string; description?: string }>; items: Array<{ name: string; description?: string }> } | null;
}

const CastSetupPhase: React.FC<CastSetupPhaseProps> = ({
    deckApi,
    showAiAnalysisModal,
    isAiAnalyzing,
    onAiAnalysis,
    onNextPhase,
    onPrevPhase,
    nextLabel,
    templateId,
    templateName,
    castPreset,
}) => {
    const {
        deck, deckChars, deckBgs, deckItems,
        aiCards, manualCards,
        poolTab, setPoolTab,
        poolFilter, setPoolFilter,
        addType, setAddType,
        newCard, setNewCard,
        showInlineNew, setShowInlineNew,
        isDeckSelected, addToDeck, removeFromDeck,
        handleAddCard, handleGenerateAsset,
        getPoolSections,
    } = deckApi;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* AI 분석 팝업 모달 */}
            {showAiAnalysisModal && (
                <AiAnalysisModal
                    isAnalyzing={isAiAnalyzing}
                    onAnalyze={onAiAnalysis}
                    templateId={templateId}
                    templateName={templateName}
                    castPreset={castPreset}
                />
            )}

            <div className="sb-phase-title">
                <span>2단계: 촬영 카드 선택</span>
                <span className="sb-phase-title__progress">
                    AI {aiCards.length}/{MAX_AI_SLOTS} · 수동 {manualCards.length}/{MAX_MANUAL_SLOTS} · 총 {deck.length}/{MAX_DECK_SIZE}
                </span>
            </div>

            <div className="deck-layout" style={{ flex: 1, overflow: 'hidden' }}>
                {/* LEFT: 내 덱 (카드 선택 단계는 넓게) */}
                <DeckPanel
                    deck={deck}
                    deckChars={deckChars}
                    deckBgs={deckBgs}
                    deckItems={deckItems}
                    onRemove={removeFromDeck}
                    onGenerateAsset={handleGenerateAsset}
                    style={{ width: '580px' }}
                />

                {/* RIGHT: 카드 풀 */}
                <div className="deck-pool">
                    <div className="deck-pool__tabs">
                        <button
                            className={`deck-pool__tab ${poolTab === 'library' ? 'deck-pool__tab--active' : ''}`}
                            onClick={() => { setPoolTab('library'); setShowInlineNew(false); }}
                        >
                            <Shield size={12} /> 내 라이브러리
                        </button>
                        <button
                            className={`deck-pool__tab ${poolTab === 'ai' ? 'deck-pool__tab--active' : ''}`}
                            onClick={() => { setPoolTab('ai'); setShowInlineNew(false); }}
                        >
                            <Sparkles size={12} /> AI 추천
                        </button>
                        <button
                            className={`deck-pool__tab ${poolTab === 'favorites' ? 'deck-pool__tab--active' : ''}`}
                            onClick={() => { setPoolTab('favorites'); setShowInlineNew(false); }}
                        >
                            <Star size={12} /> 즐겨찾기
                        </button>
                        <button
                            className={`deck-pool__tab ${poolTab === 'new' ? 'deck-pool__tab--active' : ''}`}
                            onClick={() => { setPoolTab('new'); setShowInlineNew(false); }}
                        >
                            새로 만들기
                        </button>
                        <div className="deck-pool__filters">
                            {(['all', 'character', 'background', 'item'] as const).map((f) => (
                                <button
                                    key={f}
                                    className={`deck-pool__filter ${poolFilter === f ? 'deck-pool__filter--active' : ''}`}
                                    onClick={() => setPoolFilter(f)}
                                >
                                    {f === 'all' ? '전체' : f === 'character' ? '캐릭터' : f === 'background' ? '배경' : '아이템'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 새 카드 만들기 탭 */}
                    {poolTab === 'new' && (
                        <div className="deck-pool__new deck-pool__new--inline">
                            <div className="deck-pool__new-types">
                                {(['character', 'background', 'item'] as const).map((t) => (
                                    <button
                                        key={t}
                                        className={`deck-pool__new-type ${addType === t ? 'deck-pool__new-type--active' : ''}`}
                                        onClick={() => setAddType(t)}
                                    >
                                        {t === 'character' ? <><User size={14} /> 캐릭터</> : t === 'background' ? <><MapPin size={14} /> 배경</> : <><Sword size={14} /> 아이템</>}
                                    </button>
                                ))}
                            </div>
                            <div className="deck-pool__new-form">
                                <div className="modal__field">
                                    <label className="modal__label">이름</label>
                                    <input
                                        className="modal__input"
                                        placeholder="이름을 입력하세요"
                                        value={newCard.name}
                                        onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                                    />
                                </div>
                                <div className="modal__field">
                                    <label className="modal__label">설명 (프롬프트)</label>
                                    <textarea
                                        className="modal__textarea"
                                        placeholder="자세히 묘사해주세요"
                                        rows={3}
                                        value={newCard.description}
                                        onChange={(e) => setNewCard({ ...newCard, description: e.target.value })}
                                    />
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ width: '100%', marginTop: 8 }}
                                    onClick={handleAddCard}
                                    disabled={!newCard.name || !newCard.description}
                                >
                                    <Plus size={14} /> 덱에 추가
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 풀 그리드 */}
                    <div className="deck-pool__grid">
                        {getPoolSections().map((section, si) => (
                            section.cards.length > 0 && (
                                <React.Fragment key={section.label}>
                                    <div className={`deck-pool__section-label${si > 0 ? ' deck-pool__section-label--secondary' : ''}`}>
                                        {section.icon === 'sparkles' ? <Sparkles size={10} /> : <Star size={10} />}
                                        {section.label}
                                        <span className="deck-pool__section-count">{section.cards.length}</span>
                                    </div>
                                    {section.cards.map((card: AssetCard) => {
                                        const inDeck = isDeckSelected(card.id);
                                        return (
                                            <div
                                                key={card.id}
                                                className={`pool-card ${inDeck ? 'pool-card--in-deck' : ''}`}
                                                onClick={() => inDeck ? removeFromDeck(card.id) : addToDeck(card)}
                                            >
                                                <div className="pool-card__img-wrap">
                                                    {card.imageUrl ? (
                                                        <img src={card.imageUrl} className="pool-card__img" alt={card.name} />
                                                    ) : (
                                                        <div
                                                            className="pool-card__img pool-card__img--empty"
                                                            style={{ background: `linear-gradient(180deg, hsl(${card.seed % 360}, 20%, 25%) 0%, hsl(${card.seed % 360}, 15%, 15%) 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            {card.type === 'character' ? <User size={24} /> : card.type === 'background' ? <MapPin size={24} /> : <Sword size={24} />}
                                                        </div>
                                                    )}
                                                    {card.isRequired && <span className="pool-card__ai-badge">AI 추천</span>}
                                                    {card.isFavorite && <Star size={11} className="pool-card__star" />}
                                                    {inDeck && <div className="pool-card__selected-overlay"><CheckCircle2 size={24} /><span>선택됨</span></div>}
                                                </div>
                                                <div className="pool-card__info">
                                                    <div className="pool-card__name">{card.name}</div>
                                                    <div className="pool-card__desc">{card.description}</div>
                                                    <div className="pool-card__meta">
                                                        <span className="pool-card__type-badge" data-type={card.type}>
                                                            {card.type === 'character' ? '캐릭터' : card.type === 'background' ? '배경' : '아이템'}
                                                        </span>
                                                        <span className="pool-card__seed"><Hash size={8} />{card.seed}</span>
                                                    </div>
                                                </div>
                                                <div className={`pool-card__action-bar ${inDeck ? 'pool-card__action-bar--remove' : ''}`}>
                                                    {inDeck ? <><X size={11} /> 덱에서 제거</> : <><Plus size={11} /> 덱에 추가</>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            )
                        ))}

                        {/* 인라인 새 카드 추가 */}
                        {!showInlineNew ? (
                            <div className="pool-card pool-card--add-new" onClick={() => setShowInlineNew(true)}>
                                <Plus size={28} /><span>새 카드 추가</span>
                            </div>
                        ) : (
                            <div className="pool-card--inline-form">
                                <div className="pool-card--inline-form__header">
                                    <span>새 카드 만들기</span>
                                    <button onClick={() => setShowInlineNew(false)}><X size={12} /></button>
                                </div>
                                <div className="pool-card--inline-form__types">
                                    {(['character', 'background', 'item'] as const).map((t) => (
                                        <button
                                            key={t}
                                            className={`pool-card--inline-form__type ${addType === t ? 'pool-card--inline-form__type--active' : ''}`}
                                            onClick={() => setAddType(t)}
                                        >
                                            {t === 'character' ? <User size={10} /> : t === 'background' ? <MapPin size={10} /> : <Sword size={10} />}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    className="pool-card--inline-form__input"
                                    placeholder="이름"
                                    value={newCard.name}
                                    onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                                />
                                <textarea
                                    className="pool-card--inline-form__textarea"
                                    placeholder="프롬프트 설명"
                                    rows={3}
                                    value={newCard.description}
                                    onChange={(e) => setNewCard({ ...newCard, description: e.target.value })}
                                />
                                <button
                                    className="btn-primary"
                                    style={{ width: '100%', fontSize: '0.6875rem', padding: '6px' }}
                                    onClick={handleAddCard}
                                    disabled={!newCard.name || !newCard.description}
                                >
                                    <Plus size={11} /> 덱에 추가
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="sb-bottom-actions">
                {onPrevPhase && (
                    <button className="btn-secondary" onClick={onPrevPhase}>
                        이전
                    </button>
                )}
                <span className="sb-bottom-actions__info">
                    {deck.filter((c) => c.status === 'done').length}/{deck.length} 카드 준비 완료
                </span>
                <button className="btn-primary sb-bottom-actions__btn" onClick={onNextPhase}>
                    {nextLabel ?? '다음: 컷 분할'} <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default CastSetupPhase;
