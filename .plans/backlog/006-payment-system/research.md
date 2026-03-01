# 006 결제 시스템 리서치

> 작성: CTO 일론 | 2026-02-28
> 목적: Stripe + 토스페이먼츠 결제 연동을 위한 현황 분석 및 기술 조사

---

## 1. 현재 크레딧 시스템 분석

### 1.1 크레딧 구조 (2계층)

VISION.md에 정의된 크레딧 = **플랫폼 이용료**(항상) + **AI API 비용**(BYOK 시 면제)

| 작업 | 플랫폼 이용료 | API 비용 | 합계(기본) | 합계(BYOK) |
|------|-------------|---------|-----------|-----------|
| 대본 | 1 | 1 | 2 | 1 |
| 이미지 | 1 | 2 | 3 | 1 |
| 영상 | 2 | 8 | 10 | 2 |
| TTS | 1 | 1 | 2 | 1 |
| 카드 | 1 | 2 | 3 | 1 |

### 1.2 현재 구현 파일

| 파일 | 역할 |
|------|------|
| `src/data/creditCosts.ts` | CREDIT_COST_TABLE 정의 (platformFee, apiCost, total, totalByok) |
| `src/hooks/useCredits.ts` | canAfford(), spend(), getCost(), addCredits() 훅 |
| `src/store/projectStore.ts` | credits: 10000, spendCredits(), addCredits(), resetCredits() |
| `src/store/settingsStore.ts` | BYOK API 키 관리, hasApiKeyForAction() |
| `src/pages/SettingsPage.tsx` | 크레딧 잔액 표시, 테스트 충전, 구독 플랜 UI(미연결), BYOK 키 관리 |
| `src/components/NavBar.tsx` | 크레딧 잔액 + Upgrade 링크 |
| `src/pages/AdminPage.tsx` | 시스템 통계 (Mock) |

### 1.3 크레딧 소비 지점 (9곳)

| 위치 | 액션 | 타입 |
|------|------|------|
| IdeaPage | AI 대본 생성 | script |
| CastSetupPhase | 에셋 이미지 생성 | image |
| SeedCheckPhase | 씬 이미지 생성 (단건/일괄) | image |
| SeedCheckPhase | 씬 영상 생성 (단건/일괄) | video |
| TimelinePage | 나레이션 TTS 생성 | tts |
| CastPage | AI 카드 생성 | image |
| NarrationVoiceStep | TTS 생성 | tts |
| NarrationVideoStep | 영상화 | video |

### 1.4 핵심 보안 문제

**현재 크레딧이 localStorage(Zustand persist)에 저장됨** → DevTools에서 `antigravity-project` 수정으로 크레딧 무제한 조작 가능.

실 결제 연동 시 반드시 **서버 사이드(Supabase DB)로 이전** 필요.

### 1.5 Supabase DB 스키마 (기존)

`src/types/database.ts`에 이미 정의됨:
- `users.plan`: `'free' | 'pro' | 'enterprise'`
- `users.credits_remaining`: number
- `generations.cost_credits`: number

→ DB 스키마는 준비되어 있으나, 프론트엔드와 동기화되지 않는 상태.

---

## 2. 결제 시스템 기술 조사

### 2.1 Stripe (국제 결제)

**패키지:**
- `@stripe/stripe-js` — 프론트엔드 Stripe.js 로더
- `@stripe/react-stripe-js` — React Elements/EmbeddedCheckout
- `stripe` — 서버 사이드 SDK (Edge Function에서 사용)

**권장 방식: Checkout Session (원타임 크레딧 팩)**
1. 프론트: "크레딧 구매" 클릭
2. Edge Function: `stripe.checkout.sessions.create()` 호출
3. Stripe 호스팅 결제 페이지로 리다이렉트
4. 결제 완료 → Stripe → 웹훅 → Edge Function → DB 크레딧 추가

**Stripe 키 관리:**
- Publishable Key → `.env` (VITE_STRIPE_PUBLISHABLE_KEY) — 프론트 노출 OK
- Secret Key → Supabase Edge Function Secrets — 서버만 접근
- Webhook Secret → Supabase Edge Function Secrets

### 2.2 토스페이먼츠 (국내 결제)

**패키지:** `@tosspayments/tosspayments-sdk` (v2)

**권장 방식: 결제위젯 → Confirm API**
1. 프론트: SDK 로드 → 결제위젯 렌더링 (카드/계좌이체/간편결제 통합)
2. 유저 결제 완료 → successUrl로 리다이렉트 (paymentKey, orderId, amount)
3. 프론트 → Edge Function: 3개 파라미터 전송
4. Edge Function: Toss Confirm API 호출 (Secret Key로 서버 사이드 검증)
5. 성공 → DB 크레딧 추가

**토스 키 관리:**
- Client Key → `.env` (VITE_TOSS_CLIENT_KEY) — 프론트 노출 OK
- Secret Key → Supabase Edge Function Secrets

**지원 결제 수단:**
- 신용/체크카드, 계좌이체, 간편결제(토스페이/네이버/카카오/삼성/애플)

### 2.3 Supabase Edge Functions

**웹훅 처리에 적합:**
- Deno 런타임, TypeScript 네이티브
- 별도 서버 불필요 (Vercel API Routes 없이 가능)
- Supabase Secrets로 API 키 안전 저장
- DB 직접 접근 (service_role_key)
- 공식 Stripe 웹훅 예제 존재

**필요한 Edge Functions (4개):**
| 함수 | 트리거 | 용도 |
|------|--------|------|
| create-checkout-session | 프론트엔드 | Stripe Checkout Session 생성 |
| stripe-webhook | Stripe 서버 | 결제 이벤트 처리 |
| create-toss-order | 프론트엔드 | 토스 결제 전 주문 기록 생성 |
| toss-confirm | 프론트엔드 | 토스 결제 서버 사이드 확인 |

### 2.4 멱등성(Idempotency) 보장

**결제 → 크레딧 동기화의 핵심 안전 장치:**
- `payment_events` 테이블에 `stripe_event_id` 또는 `toss_payment_key` UNIQUE 제약
- 웹훅/confirm 처리 전 중복 체크
- PostgreSQL 함수로 원자적 크레딧 추가 (`add_credits` RPC)

---

## 3. DB 스키마 설계

### 3.1 신규 테이블

```sql
-- 유저 크레딧 잔액 (source of truth)
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INT NOT NULL DEFAULT 0,
  lifetime_spent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 크레딧 거래 내역 (append-only 감사 로그)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  amount INT NOT NULL,         -- 양수=충전, 음수=소비
  type TEXT NOT NULL,          -- purchase, spend, refund, signup_bonus, admin_grant
  description TEXT,
  reference_id TEXT,           -- payment_event_id 또는 generation_id
  balance_after INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 주문 (결제 요청 시 생성)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL, -- 상점 주문번호
  user_id UUID REFERENCES auth.users(id),
  credit_amount INT NOT NULL,
  amount INT NOT NULL,           -- 결제 금액 (원)
  payment_gateway TEXT NOT NULL, -- stripe | toss
  status TEXT DEFAULT 'pending', -- pending, completed, failed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 결제 이벤트 (멱등성 보장)
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
```

### 3.2 PostgreSQL 함수

```sql
-- 크레딧 추가 (결제 후)
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
$$ LANGUAGE plpgsql;

-- 크레딧 소비 (AI 생성 시)
CREATE OR REPLACE FUNCTION spend_credits(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE new_balance INT;
BEGIN
  UPDATE user_credits
  SET balance = balance - p_amount,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND balance >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  SELECT balance INTO new_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 한국 시장 고려사항

### 4.1 사업자등록 요건

토스페이먼츠 PG 계약에 필요:
1. **사업자등록증** — 개인사업자 OK, 토스에서 바로 신청 가능
2. **통신판매업 신고** — 온라인 판매 법적 요건 (정부24)
3. **예상 소요:** 1~2주

개발 단계에서는 **테스트 키** 사용 가능 (사업자등록 없이 즉시 발급).

### 4.2 VAT

- 한국 부가세 10%, 소비자가 포함 표시 권장 ("₩19,900 VAT 포함")
- PG사가 국세청에 매출 자동 보고
- MVP에서는 수동 세금계산서 발행 (HomeTax)

### 4.3 PCI 준수

Stripe Checkout과 토스 결제위젯 모두 **카드 정보가 우리 서버를 거치지 않음** → SAQ-A (최간소 PCI 레벨) 자동 충족. 추가 작업 불필요.

---

## 5. MVP 범위 결정

### 5.1 MVP에 포함 (Phase 1)

- [x] DB 스키마 (user_credits, credit_transactions, orders, payment_events)
- [x] 크레딧 잔액을 Supabase DB로 이전 (localStorage → DB)
- [x] 크레딧 팩 원타임 구매 (100/500/1000 크레딧)
- [x] 토스페이먼츠 결제 (카드/간편결제)
- [x] Stripe 결제 (국제 카드)
- [x] Edge Functions (4개)
- [x] 결제 성공/실패 페이지
- [x] SettingsPage 결제 UI 개선

### 5.2 MVP에서 제외 (Phase 2)

- [ ] 월간 구독 (Stripe Subscription + 자동 크레딧 리셋)
- [ ] Stripe Customer Portal
- [ ] 크레딧 소비의 서버 사이드 검증 (spend-credits Edge Function)
  - MVP에서는 프론트엔드 spend + DB 잔액 동기화로 타협
  - 실 서비스 시 서버 사이드 필수
- [ ] UGC 마켓플레이스 수익 공유
- [ ] 세금계산서 자동화
- [ ] 크레딧 환불 처리

---

## 6. 리스크 및 트레이드오프

| 항목 | 리스크 | 대응 |
|------|--------|------|
| 크레딧 조작 | MVP에서 프론트 spend 유지 → 조작 가능 | DB 잔액과 주기적 동기화, Phase 2에서 서버 검증 |
| 사업자등록 지연 | 토스 PG 계약에 1~2주 | 테스트 키로 개발, 실 결제는 사업자등록 후 |
| Edge Function 장애 | 결제 후 크레딧 미적립 | 멱등성 보장 + 수동 복구 가능한 감사 로그 |
| 환율 변동 | Stripe 국제 결제 시 | 고정 KRW 가격, Stripe에서 환전 처리 |
