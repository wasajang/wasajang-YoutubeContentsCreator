/**
 * Supabase 클라이언트 초기화
 *
 * 사용법: import { supabase } from '../services/supabase';
 *
 * .env 파일에 아래 값을 설정해야 합니다:
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key-here
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[AntiGravity] Supabase 환경변수가 설정되지 않았습니다.\n' +
        'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 .env 파일에 추가해주세요.\n' +
        '현재는 로컬 전용(localStorage) 모드로 동작합니다.'
    );
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

/** Supabase가 설정되어 있는지 여부 */
export const isSupabaseConfigured = !!supabase;
