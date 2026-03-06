/**
 * DeckPanel — 스토리보드 카드 선택 단계의 왼쪽 "내 덱" 패널
 */
import React from 'react';
import { User, MapPin, Sword, Shield, Loader, X, Sparkles } from 'lucide-react';
import type { AssetCard } from '../../store/projectStore';
import { DEFAULT_DECK_SIZE } from '../../hooks/useDeck';

interface DeckPanelProps {
    deck: AssetCard[];
    deckChars: AssetCard[];
    deckBgs: AssetCard[];
    deckItems: AssetCard[];
    onRemove: (id: string) => void;
    onGenerateAsset: (id: string) => void;
    style?: React.CSSProperties;
}

const DeckCard: React.FC<{
    card: AssetCard;
    onRemove: () => void;
    onGenerate: () => void;
}> = ({ card, onRemove, onGenerate }) => (
    <div className={`deck-card ${card.type === 'background' ? 'deck-card--bg' : ''}`}>
        <div className={`deck-card__img-wrap ${card.type === 'background' ? 'deck-card__img-wrap--bg' : ''}`}>
            {card.imageUrl && card.status === 'done' ? (
                <img src={card.imageUrl} className="deck-card__img" alt={card.name} />
            ) : card.status === 'generating' ? (
                <div className="deck-card__img deck-card__img--gen">
                    <Loader size={14} className="animate-spin" />
                </div>
            ) : (
                <div className="deck-card__img deck-card__img--empty">
                    {card.type === 'character' ? <User size={16} /> : card.type === 'background' ? <MapPin size={16} /> : <Sword size={16} />}
                </div>
            )}
            <button className="deck-card__remove" onClick={onRemove}><X size={8} /></button>
            {card.status !== 'done' && (
                <button className="deck-card__gen" onClick={onGenerate}><Sparkles size={8} /></button>
            )}
        </div>
        <span className="deck-card__name">{card.name.split(' ')[0]}</span>
        <span className="deck-card__seed">#{card.seed}</span>
    </div>
);

const DeckPanel: React.FC<DeckPanelProps> = ({
    deck,
    deckChars,
    deckBgs,
    deckItems,
    onRemove,
    onGenerateAsset,
    style,
}) => (
    <div className="deck-selected" style={style}>
        <div className="deck-selected__header">
            <Shield size={16} />
            <span className="deck-selected__title">내 덱</span>
            <span className="deck-selected__count">{deck.length}/{DEFAULT_DECK_SIZE}{deck.length > DEFAULT_DECK_SIZE ? ` (+${deck.length - DEFAULT_DECK_SIZE})` : ''}</span>
        </div>
        <div className="deck-group">
            <div className="deck-group__label">
                <User size={11} /> 캐릭터 <span className="deck-group__cnt">{deckChars.length}</span>
            </div>
            <div className="deck-group__cards">
                {deckChars.map((card) => (
                    <DeckCard key={card.id} card={card} onRemove={() => onRemove(card.id)} onGenerate={() => onGenerateAsset(card.id)} />
                ))}
            </div>
        </div>
        <div className="deck-group">
            <div className="deck-group__label">
                <MapPin size={11} /> 배경 <span className="deck-group__cnt">{deckBgs.length}</span>
            </div>
            <div className="deck-group__cards">
                {deckBgs.map((card) => (
                    <DeckCard key={card.id} card={card} onRemove={() => onRemove(card.id)} onGenerate={() => onGenerateAsset(card.id)} />
                ))}
            </div>
        </div>
        <div className="deck-group">
            <div className="deck-group__label">
                <Sword size={11} /> 아이템 <span className="deck-group__cnt">{deckItems.length}</span>
            </div>
            <div className="deck-group__cards">
                {deckItems.map((card) => (
                    <DeckCard key={card.id} card={card} onRemove={() => onRemove(card.id)} onGenerate={() => onGenerateAsset(card.id)} />
                ))}
            </div>
        </div>
    </div>
);

export default DeckPanel;
