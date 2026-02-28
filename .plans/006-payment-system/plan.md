# 006 결제 시스템 구현 계획

> 작성: CTO 일론 | 2026-02-28
> 상태: CEO 검토 대기
> 의존: 004(AI 연동) ✅, 005(나레이션) ✅
> 참조: `research.md`, `VISION.md` 섹션 5·7

---

## 개요

**목표:** 크레딧 구매 결제 시스템 (토스 + Stripe) 구축
**범위:** DB 스키마 → Edge Functions → 프론트엔드 결제 UI
**제외:** 월간 구독, 크레딧 소비 서버 검증, UGC 수익 공유

---

## Phase A: DB 스키마 + 크레딧 마이그레이션

> 크레딧 저장소를 localStorage → Supabase DB로 이전

### A-1. Supabase 마이그레이션 SQL

**파일:** `supabase/migrations/006_payment_tables.sql` (신규)

```sql
-- 유저 크레딧 잔액
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance INT NOT NULL DEFAULT 100 CHECK (balance >= 0),
  lifetime_purchased INT NOT NULL DEFAULT 0,
  lifetime_spent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own" ON user_credits FOR SELECT USING (auth.uid() = user_id);

-- 크레딧 거래 내역
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  amount INT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- 주문
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  credit_amount INT NOT NULL,
  amount INT NOT NULL,
  payment_gateway TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own" ON orders FOR SELECT USING (auth.uid() = user_id);

-- 결제 이벤트 (멱등성)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  toss_payment_key TEXT UNIQUE,
  order_id TEXT REFERENCES orders(order_id),
  user_id UUID REFERENCES auth.users(id),
  amount INT,
  credit_amount INT,
  status TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- PostgreSQL 함수: 크레딧 추가
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE new_balance INT;
BEGIN
  INSERT INTO user_credits (user_id, balance, lifetime_purchased)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + p_amount,
      lifetime_purchased = user_credits.lifetime_purchased + p_amount,
      updated_at = NOW();
  SELECT balance INTO new_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PostgreSQL 함수: 크레딧 소비
CREATE OR REPLACE FUNCTION spend_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE new_balance INT;
BEGIN
  UPDATE user_credits
  SET balance = balance - p_amount,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient credits'; END IF;
  SELECT balance INTO new_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 신규 가입 시 무료 크레딧 자동 지급 트리거
CREATE OR REPLACE FUNCTION handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, balance) VALUES (NEW.id, 100);
  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (NEW.id, 100, 'signup_bonus', '가입 보너스 100 크레딧', 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();
```

### A-2. 크레딧 서비스 레이어

**파일:** `src/services/credit-api.ts` (신규)

```typescript
import { supabase } from './supabase';

/** DB에서 크레딧 잔액 조회 */
export async function fetchCredits(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data?.balance ?? 0;
}

/** 크레딧 소비 (DB 차감) */
export async function spendCreditsServer(userId: string, amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('spend_credits', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) throw error;
  return data as number; // new balance
}

/** 크레딧 거래 내역 조회 */
export async function fetchTransactions(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

### A-3. useCredits 훅 수정

**파일:** `src/hooks/useCredits.ts` (수정)

변경 내용:
- 게스트 모드: 기존 localStorage 방식 유지 (로그인 없이 테스트 가능)
- 로그인 상태: Supabase DB에서 잔액 조회, spendCreditsServer() 호출
- projectStore.credits는 **표시용 캐시**로만 사용

```typescript
// 핵심 변경:
// 1. useAuth()에서 user 확인
// 2. 로그인 시 → fetchCredits() + spendCreditsServer()
// 3. 게스트 시 → 기존 projectStore.spendCredits() (하위 호환)
```

### A-4. 타입 정의 업데이트

**파일:** `src/types/database.ts` (수정)

```typescript
// 기존 users 타입에 이미 plan, credits_remaining 있음
// 신규 테이블 타입 추가
export interface UserCredits {
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'purchase' | 'spend' | 'refund' | 'signup_bonus' | 'admin_grant';
  description: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_id: string;
  user_id: string;
  credit_amount: number;
  amount: number;
  payment_gateway: 'stripe' | 'toss';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
}
```

---

## Phase B: 토스페이먼츠 연동

> 국내 결제 (카드/간편결제)

### B-1. 패키지 설치

```bash
npm install @tosspayments/tosspayments-sdk
```

### B-2. 환경 변수

**파일:** `.env.example` (수정)

```bash
# Payment
VITE_TOSS_CLIENT_KEY=test_ck_... # 토스 클라이언트 키 (프론트용)
# TOSS_SECRET_KEY는 Supabase Edge Function Secrets에 저장
```

### B-3. 크레딧 팩 데이터

**파일:** `src/data/creditPacks.ts` (신규)

```typescript
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceKRW: number;       // 원화 가격 (VAT 포함)
  priceUSD: number;       // 달러 가격
  stripePriceId?: string; // Stripe Price ID (Stripe 대시보드에서 생성)
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter',    name: 'Starter',    credits: 100,  priceKRW: 4900,   priceUSD: 3.99 },
  { id: 'pro',        name: 'Pro',        credits: 500,  priceKRW: 19900,  priceUSD: 14.99, popular: true },
  { id: 'enterprise', name: 'Enterprise', credits: 1500, priceKRW: 49900,  priceUSD: 37.99 },
];
```

### B-4. 결제 서비스

**파일:** `src/services/payment-api.ts` (신규)

```typescript
import { supabase } from './supabase';

/** 주문 생성 (결제 전) */
export async function createOrder(params: {
  userId: string;
  creditAmount: number;
  amount: number;
  gateway: 'stripe' | 'toss';
}): Promise<string> {
  const orderId = `AG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('orders').insert({
    order_id: orderId,
    user_id: params.userId,
    credit_amount: params.creditAmount,
    amount: params.amount,
    payment_gateway: params.gateway,
  });
  if (error) throw error;
  return orderId;
}

/** 토스 결제 확인 (서버 사이드 검증) */
export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<{ success: boolean; credits: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toss-confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(params),
    }
  );
  if (!res.ok) throw new Error('결제 확인 실패');
  return res.json();
}
```

### B-5. Edge Function — toss-confirm

**파일:** `supabase/functions/toss-confirm/index.ts` (신규)

핵심 로직:
1. Auth 토큰에서 user_id 추출
2. orders 테이블에서 주문 검증 (user_id + orderId + amount 매칭)
3. 토스 Confirm API 호출 (Secret Key, Basic Auth)
4. payment_events 멱등성 체크
5. add_credits RPC 호출
6. credit_transactions 기록
7. 새 잔액 반환

### B-6. Edge Function — create-toss-order

**파일:** `supabase/functions/create-toss-order/index.ts` (신규)

핵심 로직:
1. Auth 토큰 검증
2. orders 테이블에 주문 기록 INSERT
3. orderId 반환

### B-7. 결제 페이지 (프론트)

**파일:** `src/pages/PaymentPage.tsx` (신규)

- Route: `/payment` (크레딧 팩 선택 + 결제)
- Route: `/payment/success` (결제 성공 처리)
- Route: `/payment/fail` (결제 실패 안내)

```
결제 플로우:
1. /payment → 크레딧 팩 3개 표시
2. 팩 선택 → "토스로 결제" 또는 "Stripe로 결제" 버튼
3. 토스 선택 → createOrder() → 토스 SDK requestPayment()
4. 결제 완료 → /payment/success?paymentKey=...&orderId=...&amount=...
5. success 페이지에서 confirmTossPayment() 호출
6. 성공 → 크레딧 잔액 갱신 + 축하 메시지
```

---

## Phase C: Stripe 연동

> 국제 결제

### C-1. 패키지 설치

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### C-2. 환경 변수

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Stripe 공개 키 (프론트용)
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET → Supabase Secrets
```

### C-3. Edge Function — create-checkout-session

**파일:** `supabase/functions/create-checkout-session/index.ts` (신규)

핵심 로직:
1. Auth 토큰 검증
2. Stripe Checkout Session 생성 (mode: 'payment', metadata에 user_id + credit_amount)
3. session.url 반환 → 프론트에서 리다이렉트

### C-4. Edge Function — stripe-webhook

**파일:** `supabase/functions/stripe-webhook/index.ts` (신규)

핵심 로직:
1. Stripe signature 검증
2. checkout.session.completed 이벤트 처리
3. payment_events 멱등성 체크
4. add_credits RPC 호출
5. credit_transactions 기록

### C-5. PaymentPage Stripe 플로우 추가

기존 PaymentPage에 Stripe 버튼 추가:
1. "해외 카드로 결제" 클릭
2. Edge Function 호출 → Checkout Session URL 받기
3. Stripe 호스팅 결제 페이지로 리다이렉트
4. 결제 완료 → /payment/success?stripe=true 리다이렉트
5. 웹훅이 비동기로 크레딧 추가 → 프론트에서 잔액 폴링/새로고침

---

## Phase D: UI 통합

### D-1. SettingsPage 개선

**파일:** `src/pages/SettingsPage.tsx` (수정)

변경 내용:
- 크레딧 잔액: DB에서 실시간 조회
- "크레딧 충전" 버튼 → `/payment` 페이지로 이동
- 결제 내역 표시 (credit_transactions)
- 테스트 충전 버튼은 게스트 모드에서만 표시

### D-2. NavBar 업그레이드 버튼

**파일:** `src/components/NavBar.tsx` (수정)

- "Upgrade" 버튼 → `/payment` 링크로 변경 (현재 `/settings`)
- 크레딧 잔액 DB 동기화

### D-3. 라우터 추가

**파일:** `src/App.tsx` (수정)

```typescript
<Route path="/payment" element={<PaymentPage />} />
<Route path="/payment/success" element={<PaymentSuccessPage />} />
<Route path="/payment/fail" element={<PaymentFailPage />} />
```

---

## 파일 변경 요약

| 파일 | 작업 | Phase |
|------|------|-------|
| `supabase/migrations/006_payment_tables.sql` | 신규 | A |
| `src/types/database.ts` | 수정 (타입 추가) | A |
| `src/services/credit-api.ts` | 신규 | A |
| `src/hooks/useCredits.ts` | 수정 (DB 연동) | A |
| `src/data/creditPacks.ts` | 신규 | B |
| `src/services/payment-api.ts` | 신규 | B |
| `supabase/functions/toss-confirm/index.ts` | 신규 | B |
| `supabase/functions/create-toss-order/index.ts` | 신규 | B |
| `src/pages/PaymentPage.tsx` | 신규 | B |
| `.env.example` | 수정 | B |
| `supabase/functions/create-checkout-session/index.ts` | 신규 | C |
| `supabase/functions/stripe-webhook/index.ts` | 신규 | C |
| `src/pages/SettingsPage.tsx` | 수정 | D |
| `src/components/NavBar.tsx` | 수정 | D |
| `src/App.tsx` | 수정 (라우트 추가) | D |
| `src/index.css` | 수정 (결제 UI CSS) | D |

**신규 파일: 9개 | 수정 파일: 7개 | 총 16개 파일**

---

## 실행 계획

### 에이전트 배정

| Phase | 담당 | 모델 | 비고 |
|-------|------|------|------|
| A (DB + 크레딧 서비스) | 카이(AI) | Sonnet | DB 스키마 + credit-api |
| B (토스) | 카이(AI) | Sonnet | Edge Functions + payment-api |
| C (Stripe) | 카이(AI) | Sonnet | Edge Functions |
| D (UI) | 린(FE) | Sonnet | PaymentPage + SettingsPage + NavBar |
| CSS | 누리(CSS) 또는 CTO | Haiku | 결제 페이지 스타일 |
| QA | 타로(QA) | Haiku | 빌드 검증 |

### 병렬화

```
Wave 1: Phase A (DB + 크레딧 서비스)
Wave 2: Phase B + C 병렬 (토스 + Stripe Edge Functions)
Wave 3: Phase D (UI 통합)
Wave 4: QA
```

### 검증 방법

1. `npm run build` — 빌드 성공
2. Supabase Dashboard에서 테이블/함수 확인
3. 토스 테스트 키로 결제 플로우 E2E 테스트
4. Stripe 테스트 키로 결제 플로우 E2E 테스트
5. 크레딧 잔액 DB↔프론트 동기화 확인

---

## CEO 결정 필요 사항

### 1. 크레딧 팩 가격

현재 제안:
| 팩 | 크레딧 | 가격(KRW) | 크레딧당 단가 |
|----|--------|-----------|-------------|
| Starter | 100 | ₩4,900 | ₩49 |
| Pro | 500 | ₩19,900 | ₩39.8 |
| Enterprise | 1,500 | ₩49,900 | ₩33.3 |

→ 많이 살수록 단가 할인. 이 가격이 적절한지?

### 2. 무료 가입 크레딧

현재 제안: **100 크레딧** (가입 시 자동 지급)
→ 이미지 약 33장 또는 영상 약 10개 생성 가능. 적절한지?

### 3. 구현 우선순위

토스 먼저 vs Stripe 먼저?
→ CTO 추천: **토스 먼저** (국내 사용자 타겟, 테스트 키 즉시 사용 가능)

### 4. Edge Functions 배포 환경

Supabase Edge Functions를 이미 설정한 적 있는지?
→ 없다면 `supabase init` + `supabase login` 세팅이 선행 필요
