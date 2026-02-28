import { supabase } from './supabase';
import type { DbUserCredits, DbCreditTransaction } from '../types/database';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  return supabase;
}

/** DB에서 크레딧 잔액 조회 */
export async function fetchCredits(userId: string): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();
  if (error) {
    // 행이 없으면 0 반환 (아직 user_credits 생성 안 된 유저)
    if (error.code === 'PGRST116') return 0;
    throw error;
  }
  return (data as any)?.balance ?? 0;
}

/** 크레딧 거래 내역 조회 */
export async function fetchTransactions(userId: string, limit = 20): Promise<DbCreditTransaction[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as any as DbCreditTransaction[];
}

/** 크레딧 잔액 전체 정보 조회 */
export async function fetchCreditInfo(userId: string): Promise<DbUserCredits | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as any as DbUserCredits;
}
