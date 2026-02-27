/**
 * useDeck — 스토리보드 덱(카드 선택) 상태 관리 훅
 *
 * StoryboardPage의 cast-setup 단계에서 사용하는 모든 덱 관련 상태와 액션을 담당합니다.
 */
import { useState } from 'react';
import type { AssetCard, AssetType } from '../store/projectStore';
import { aiSuggestedCards, favoritesPool } from '../data/mockData';
import { generateImage } from '../services/ai-image';
import type { GenerationType } from './useCredits';

// ── 덱 제한 상수 (다른 파일에서도 참조) ──
export const MAX_AI_SLOTS = 5;
export const MAX_MANUAL_SLOTS = 3;
export const MAX_DECK_SIZE = 8;

interface UseDeckParams {
    cardLibrary: AssetCard[];
    addToCardLibrary: (card: AssetCard) => void;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType) => boolean;
    creditsRemaining: number;
    CREDIT_COSTS: Record<GenerationType, number>;
}

export function useDeck({
    cardLibrary,
    addToCardLibrary,
    canAfford,
    spend,
    creditsRemaining,
    CREDIT_COSTS,
}: UseDeckParams) {
    const [deck, setDeck] = useState<AssetCard[]>([]);
    const [poolTab, setPoolTab] = useState<'library' | 'ai' | 'favorites' | 'new'>('library');
    const [poolFilter, setPoolFilter] = useState<AssetType | 'all'>('all');
    const [addType, setAddType] = useState<AssetType>('character');
    const [newCard, setNewCard] = useState({ name: '', description: '' });
    const [showInlineNew, setShowInlineNew] = useState(false);
    const [showManualAddModal, setShowManualAddModal] = useState(false);

    // ── 덱 필터 계산 ──
    const deckChars = deck.filter((c) => c.type === 'character');
    const deckBgs = deck.filter((c) => c.type === 'background');
    const deckItems = deck.filter((c) => c.type === 'item');
    const aiCards = deck.filter((c) => c.source === 'ai');
    const manualCards = deck.filter((c) => c.source === 'manual');
    const manualSlotsRemaining = MAX_MANUAL_SLOTS - manualCards.length;

    const isDeckSelected = (id: string) => deck.some((c) => c.id === id);

    // ── 덱 추가 (제한 가드 포함) ──
    const addToDeck = (card: AssetCard) => {
        if (isDeckSelected(card.id)) return;
        if (deck.length >= MAX_DECK_SIZE) return;
        const source = card.source || 'ai';
        if (source === 'ai' && aiCards.length >= MAX_AI_SLOTS) return;
        if (source === 'manual' && manualCards.length >= MAX_MANUAL_SLOTS) return;
        const cardWithSource = { ...card, source };
        setDeck((p) => [...p, cardWithSource]);
        addToCardLibrary(cardWithSource);
    };

    const removeFromDeck = (id: string) => setDeck((p) => p.filter((c) => c.id !== id));

    // ── 새 카드 풀에서 덱에 추가 ──
    const handleAddCard = () => {
        const card: AssetCard = {
            id: `new-${Date.now()}`,
            name: newCard.name,
            type: addType,
            description: newCard.description,
            imageUrl: '',
            seed: Math.floor(Math.random() * 99999),
            status: 'pending',
            source: 'ai',
        };
        setDeck((p) => [...p, card]);
        addToCardLibrary(card);
        setNewCard({ name: '', description: '' });
        setShowInlineNew(false);
    };

    // ── 덱 카드 AI 이미지 생성 ──
    const handleGenerateAsset = async (id: string) => {
        if (!canAfford('image')) {
            alert(`크레딧이 부족합니다! (이미지 생성 ${CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            return;
        }
        if (!spend('image')) return;
        setDeck((p) => p.map((c) => c.id === id ? { ...c, status: 'generating' as const } : c));
        try {
            const card = deck.find((c) => c.id === id);
            if (!card) return;
            const result = await generateImage({
                prompt: `${card.description}, high quality portrait`,
                seed: card.seed,
            });
            setDeck((p) => p.map((c) => c.id === id ? { ...c, status: 'done' as const, imageUrl: result.imageUrl } : c));
        } catch (err) {
            console.error(`[Asset ${id}] 생성 실패:`, err);
            setDeck((p) => p.map((c) => c.id === id ? { ...c, status: 'pending' as const } : c));
        }
    };

    // ── 수동 카드를 덱에 추가 (ManualAddModal에서 호출) ──
    const handleManualAddCard = (card: AssetCard) => {
        setDeck((p) => [...p, card]);
        addToCardLibrary(card);
    };

    // ── 풀 섹션 계산 ──
    const getPoolSections = (): Array<{ label: string; icon: 'sparkles' | 'star'; cards: AssetCard[] }> => {
        const filter = (cards: AssetCard[]) =>
            poolFilter === 'all' ? cards : cards.filter((c) => c.type === poolFilter);
        if (poolTab === 'library') {
            return [{ label: '내 라이브러리', icon: 'star', cards: filter(cardLibrary) }];
        }
        if (poolTab === 'ai') {
            const libIds = new Set(cardLibrary.map((c) => c.id));
            return [{ label: 'AI 추천', icon: 'sparkles', cards: filter(aiSuggestedCards.filter((c) => !libIds.has(c.id))) }];
        }
        if (poolTab === 'favorites') {
            const libFavs = cardLibrary.filter((c) => c.isFavorite);
            const libIds = new Set(cardLibrary.map((c) => c.id));
            const externalFavs = favoritesPool.filter((c) => !libIds.has(c.id));
            return [{ label: '즐겨찾기', icon: 'star', cards: filter([...libFavs, ...externalFavs]) }];
        }
        return [{ label: '내 라이브러리', icon: 'star', cards: filter(cardLibrary) }];
    };

    return {
        deck,
        setDeck,
        poolTab,
        setPoolTab,
        poolFilter,
        setPoolFilter,
        addType,
        setAddType,
        newCard,
        setNewCard,
        showInlineNew,
        setShowInlineNew,
        showManualAddModal,
        setShowManualAddModal,
        deckChars,
        deckBgs,
        deckItems,
        aiCards,
        manualCards,
        manualSlotsRemaining,
        isDeckSelected,
        addToDeck,
        removeFromDeck,
        handleAddCard,
        handleGenerateAsset,
        handleManualAddCard,
        getPoolSections,
    };
}

export type UseDeckApi = ReturnType<typeof useDeck>;
