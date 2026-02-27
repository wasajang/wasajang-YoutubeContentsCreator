import React from 'react';
import {
    User, MapPin, Sword, Hash, Check, X, Plus, Shield,
} from 'lucide-react';
import type { AssetCard } from '../../store/projectStore';

interface CastStripProps {
    deck: AssetCard[];
    maxDeckSize: number;
    selectedScene: string | null;
    sceneSeeds: Record<string, string[]>;
    manualSlotsRemaining: number;
    onToggleSeed: (sceneId: string, cardId: string) => void;
    onRemoveFromDeck: (id: string) => void;
    onOpenManualAdd: () => void;
}

/** 카드 타입별 아이콘 */
const typeIcon = (type: string, size = 14) =>
    type === 'character' ? <User size={size} /> :
    type === 'background' ? <MapPin size={size} /> :
    <Sword size={size} />;

/** 개별 카드 렌더 */
const StripCard: React.FC<{
    card: AssetCard;
    isActive: boolean;
    selectedScene: string | null;
    variant: 'character' | 'background' | 'item' | 'manual';
    onToggle: () => void;
    onRemove?: () => void;
}> = ({ card, isActive, selectedScene, variant, onToggle, onRemove }) => {
    const classMap: Record<string, string> = {
        character: '',
        background: 'sc-cast-strip-card--bg',
        item: 'sc-cast-strip-card--item',
        manual: 'sc-cast-strip-card--manual',
    };
    const activeClass = isActive
        ? `sc-cast-strip-card--active${variant === 'background' ? ' sc-cast-strip-card--bg-active' : variant === 'item' ? ' sc-cast-strip-card--item-active' : ''}`
        : '';
    const imgClass = variant === 'background' ? 'sc-cast-strip-card__img sc-cast-strip-card__img--wide' : 'sc-cast-strip-card__img';

    return (
        <div
            className={`sc-cast-strip-card ${classMap[variant]} ${activeClass}`}
            onClick={() => selectedScene && onToggle()}
            title={selectedScene ? (isActive ? '씨드 해제' : '이 씬에 씨드 추가') : '먼저 씬을 선택하세요'}
        >
            <div className={imgClass}>
                {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : typeIcon(card.type)}
            </div>
            <div className="sc-cast-strip-card__info">
                <div className="sc-cast-strip-card__name">{variant === 'background' ? card.name.split(' ').slice(0, 2).join(' ') : card.name.split(' ')[0]}</div>
                <div className="sc-cast-strip-card__seed"><Hash size={7} />{card.seed}</div>
            </div>
            {onRemove && (
                <button className="sc-cast-strip-card__remove-btn" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="수동 카드 제거">
                    <X size={8} />
                </button>
            )}
            {isActive && <span className="sc-cast-strip-card__check"><Check size={8} /></span>}
        </div>
    );
};

const CastStrip: React.FC<CastStripProps> = ({
    deck, maxDeckSize, selectedScene, sceneSeeds,
    manualSlotsRemaining, onToggleSeed, onRemoveFromDeck, onOpenManualAdd,
}) => {
    const getActive = (cardId: string) =>
        selectedScene ? (sceneSeeds[selectedScene] || []).includes(cardId) : false;

    const aiChars = deck.filter(c => c.source === 'ai' && c.type === 'character');
    const aiBgs = deck.filter(c => c.source === 'ai' && c.type === 'background');
    const aiItems = deck.filter(c => c.source === 'ai' && c.type === 'item');
    const manualCards = deck.filter(c => c.source === 'manual');

    return (
        <div className="sc-cast-strip">
            <div className="sc-cast-strip__section-label"><Shield size={11} /> 마이덱 ({deck.length}/{maxDeckSize})</div>
            <div className="sc-cast-strip__divider" />

            {/* AI 캐릭터 */}
            {aiChars.map(card => (
                <StripCard key={`c-${card.id}`} card={card} isActive={getActive(card.id)} selectedScene={selectedScene} variant="character" onToggle={() => selectedScene && onToggleSeed(selectedScene, card.id)} />
            ))}
            <div className="sc-cast-strip__divider" />

            {/* AI 배경 */}
            {aiBgs.map(card => (
                <StripCard key={`b-${card.id}`} card={card} isActive={getActive(card.id)} selectedScene={selectedScene} variant="background" onToggle={() => selectedScene && onToggleSeed(selectedScene, card.id)} />
            ))}
            <div className="sc-cast-strip__divider" />

            {/* AI 아이템 */}
            {aiItems.map(card => (
                <StripCard key={`i-${card.id}`} card={card} isActive={getActive(card.id)} selectedScene={selectedScene} variant="item" onToggle={() => selectedScene && onToggleSeed(selectedScene, card.id)} />
            ))}

            {/* 수동 구분선 */}
            {(manualCards.length > 0 || manualSlotsRemaining > 0) && (
                <div className="sc-cast-strip__divider sc-cast-strip__divider--manual" />
            )}

            {/* 수동 카드 */}
            {manualCards.map(card => (
                <StripCard key={`m-${card.id}`} card={card} isActive={getActive(card.id)} selectedScene={selectedScene} variant="manual" onToggle={() => selectedScene && onToggleSeed(selectedScene, card.id)} onRemove={() => onRemoveFromDeck(card.id)} />
            ))}

            {/* 빈 + 슬롯 */}
            {Array.from({ length: manualSlotsRemaining }, (_, i) => (
                <button key={`add-slot-${i}`} className="sc-cast-strip__add-slot" onClick={onOpenManualAdd} title="수동 카드 추가">
                    <Plus size={14} />
                </button>
            ))}

            {!selectedScene && (
                <div className="sc-cast-strip__hint">씬을 선택하면 이곳에서 씨드를 토글할 수 있어요</div>
            )}
        </div>
    );
};

export default CastStrip;
