/**
 * 카드 라이브러리 CRUD API (Supabase)
 *
 * 캐릭터, 배경, 아이템 카드를 DB에 저장/로드합니다.
 * 카드는 프로젝트 독립적 — 유저 소유 에셋입니다.
 */
import { supabase } from './supabase';
import type { AssetCard, AssetType } from '../store/projectStore';

// ── 타입 변환 헬퍼 ──

/** Store AssetCard → DB Insert 포맷 */
function cardToDb(card: AssetCard, userId: string) {
    return {
        id: card.id,
        user_id: userId,
        name: card.name,
        type: card.type,
        description: card.description,
        image_url: card.imageUrl || null,
        seed: card.seed,
        status: card.status || 'done',
        source: card.source || 'manual',
        is_favorite: card.isFavorite || false,
    };
}

/** DB Row → Store AssetCard 포맷 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToCard(row: any): AssetCard {
    return {
        id: row.id,
        name: row.name,
        type: row.type as AssetType,
        description: row.description,
        imageUrl: row.image_url || '',
        seed: row.seed,
        status: row.status || 'done',
        source: row.source || 'manual',
        isFavorite: row.is_favorite,
    };
}

// ── Public API ──

/**
 * 카드 전체 저장 (기존 삭제 후 재삽입)
 */
export async function saveCards(userId: string, cards: AssetCard[]): Promise<void> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // 기존 카드 삭제
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('asset_cards') as any).delete().eq('user_id', userId);

    if (cards.length === 0) return;

    // 새로 삽입
    const rows = cards.map((c) => cardToDb(c, userId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('asset_cards') as any).insert(rows);

    if (error) {
        console.error('[card-api] 카드 저장 실패:', error);
        throw new Error(`카드 저장 실패: ${error.message}`);
    }

    console.log(`[card-api] 카드 ${cards.length}개 저장 완료`);
}

/**
 * 내 카드 전체 로드
 */
export async function loadCards(userId: string): Promise<AssetCard[]> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('asset_cards') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`카드 로드 실패: ${error.message}`);
    return (data || []).map(dbToCard);
}

/**
 * 단일 카드 추가/수정 (upsert)
 */
export async function upsertCard(userId: string, card: AssetCard): Promise<string> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    const row = cardToDb(card, userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('asset_cards') as any)
        .upsert(row)
        .select('id')
        .single();

    if (error) throw new Error(`카드 upsert 실패: ${error.message}`);
    return data?.id || card.id;
}

/**
 * 단일 카드 삭제
 */
export async function deleteCard(cardId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('asset_cards') as any)
        .delete()
        .eq('id', cardId);

    if (error) throw new Error(`카드 삭제 실패: ${error.message}`);
}
