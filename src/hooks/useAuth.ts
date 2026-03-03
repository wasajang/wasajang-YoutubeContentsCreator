/**
 * 인증 상태 관리 Hook
 *
 * Supabase가 설정되지 않은 경우 로컬 전용 모드로 동작합니다.
 * (게스트 사용자, localStorage 기반)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { useToastStore } from './useToast';

interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isGuest: boolean;  // Supabase 미설정 시 true
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
        isGuest: !isSupabaseConfigured,
    });

    useEffect(() => {
        if (!supabase) {
            // Supabase 미설정 → 게스트 모드
            setState({ user: null, session: null, loading: false, isGuest: true });
            return;
        }

        // 현재 세션 가져오기
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState({
                user: session?.user ?? null,
                session,
                loading: false,
                isGuest: false,
            });
        });

        // 인증 상태 변화 감시
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setState({
                    user: session?.user ?? null,
                    session,
                    loading: false,
                    isGuest: false,
                });
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    /** Google 소셜 로그인 */
    const signInWithGoogle = useCallback(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
        });
        if (error) {
            console.error('Google 로그인 실패:', error.message);
            useToastStore.getState().addToast(`Google 로그인 실패: ${error.message}`, 'error');
        }
    }, []);

    /** 카카오 소셜 로그인 */
    const signInWithKakao = useCallback(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: { redirectTo: window.location.origin },
        });
        if (error) {
            console.error('카카오 로그인 실패:', error.message);
            useToastStore.getState().addToast(`카카오 로그인 실패: ${error.message}`, 'error');
        }
    }, []);

    /** 로그아웃 */
    const signOut = useCallback(async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) console.error('로그아웃 실패:', error.message);
    }, []);

    return {
        ...state,
        signInWithGoogle,
        signInWithKakao,
        signOut,
    };
}
