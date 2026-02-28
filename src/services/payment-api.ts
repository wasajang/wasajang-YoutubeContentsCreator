import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  return supabase;
}

/** 주문 생성 (결제 전) */
export async function createOrder(params: {
  userId: string;
  creditAmount: number;
  amount: number;
  gateway: 'stripe' | 'toss';
}): Promise<string> {
  const sb = requireSupabase();
  const orderId = `AG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await sb.from('orders').insert({
    order_id: orderId,
    user_id: params.userId,
    credit_amount: params.creditAmount,
    amount: params.amount,
    payment_gateway: params.gateway,
  } as any);
  if (error) throw error;
  return orderId;
}

/** 토스 결제 확인 (Edge Function 호출) */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<{ success: boolean; credits: number; newBalance: number }> {
  const sb = requireSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 필요합니다.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/toss-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '결제 확인 실패' }));
    throw new Error(err.message || '결제 확인 실패');
  }
  return res.json();
}

/** Stripe Checkout Session 생성 (Edge Function 호출) */
export async function createStripeCheckout(params: {
  creditAmount: number;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionUrl: string }> {
  const sb = requireSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 필요합니다.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Stripe 세션 생성 실패' }));
    throw new Error(err.message || 'Stripe 세션 생성 실패');
  }
  return res.json();
}
