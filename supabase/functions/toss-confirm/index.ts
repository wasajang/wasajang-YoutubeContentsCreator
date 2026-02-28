// Supabase Edge Function — 토스페이먼츠 결제 확인
// Deno 런타임, deploy: supabase functions deploy toss-confirm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOSS_SECRET_KEY = Deno.env.get('TOSS_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. 유저 인증
    const authHeader = req.headers.get('Authorization')!;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. 요청 파싱
    const { paymentKey, orderId, amount } = await req.json();
    if (!paymentKey || !orderId || !amount) {
      return new Response(JSON.stringify({ message: 'Missing params' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. 주문 검증
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order || order.amount !== amount) {
      return new Response(JSON.stringify({ message: 'Order mismatch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. 멱등성 체크
    const { data: existing } = await adminClient
      .from('payment_events')
      .select('id')
      .eq('toss_payment_key', paymentKey)
      .maybeSingle();

    if (existing) {
      // 이미 처리됨
      const { data: credits } = await adminClient
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      return new Response(JSON.stringify({
        success: true, credits: order.credit_amount, newBalance: credits?.balance ?? 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. 토스 Confirm API 호출
    const encodedKey = btoa(`${TOSS_SECRET_KEY}:`);
    const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!confirmRes.ok) {
      const tossError = await confirmRes.json();
      await adminClient.from('orders').update({ status: 'failed' }).eq('order_id', orderId);
      return new Response(JSON.stringify({ message: tossError.message || '결제 실패' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. 결제 이벤트 기록
    await adminClient.from('payment_events').insert({
      toss_payment_key: paymentKey,
      order_id: orderId,
      user_id: user.id,
      amount,
      credit_amount: order.credit_amount,
      status: 'completed',
    });

    // 7. 크레딧 추가
    const { data: newBalance } = await adminClient.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: order.credit_amount,
    });

    // 8. 주문 완료 처리
    await adminClient.from('orders').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('order_id', orderId);

    return new Response(JSON.stringify({
      success: true,
      credits: order.credit_amount,
      newBalance: newBalance ?? 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
