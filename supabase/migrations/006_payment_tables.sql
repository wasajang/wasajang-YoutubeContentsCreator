-- 006_payment_tables.sql
-- 결제 시스템 테이블 및 RPC 함수
-- 기존 users 테이블(credits_remaining)과 별도로 user_credits 테이블 운영

-- user_credits 테이블
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 100 CHECK (balance >= 0),
  lifetime_purchased INT NOT NULL DEFAULT 0,
  lifetime_spent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uc_select_own" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);

-- credit_transactions (append-only 감사 로그)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','spend','refund','signup_bonus','admin_grant')),
  description TEXT,
  reference_id TEXT,
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_select_own" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- orders (결제 요청 시 생성)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_amount INT NOT NULL,
  amount INT NOT NULL,
  payment_gateway TEXT NOT NULL CHECK (payment_gateway IN ('stripe','toss')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- payment_events (멱등성 보장)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  toss_payment_key TEXT UNIQUE,
  order_id TEXT REFERENCES public.orders(order_id),
  user_id UUID REFERENCES auth.users(id),
  amount INT,
  credit_amount INT,
  status TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);

-- add_credits RPC
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE new_balance INT;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, lifetime_purchased)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + EXCLUDED.balance,
      lifetime_purchased = user_credits.lifetime_purchased + EXCLUDED.lifetime_purchased,
      updated_at = NOW();
  SELECT balance INTO new_balance FROM public.user_credits WHERE user_id = p_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, 'purchase', p_amount || ' 크레딧 구매', new_balance);
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- spend_credits RPC
CREATE OR REPLACE FUNCTION public.spend_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE new_balance INT;
BEGIN
  UPDATE public.user_credits
  SET balance = balance - p_amount,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient credits'; END IF;
  SELECT balance INTO new_balance FROM public.user_credits WHERE user_id = p_user_id;
  INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, -p_amount, 'spend', p_amount || ' 크레딧 소비', new_balance);
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 신규 가입 시 user_credits 자동 생성 트리거
-- NOTE: 기존 on_auth_user_created 트리거(users 테이블 삽입)와 별도 함수/트리거로 분리
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (NEW.id, 100, 'signup_bonus', '가입 보너스 100 크레딧', 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();
