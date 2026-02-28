/**
 * PaymentPage — 크레딧 충전 페이지
 *
 * 역할:
 * - 크레딧 팩(Starter/Pro/Enterprise) 3종 표시
 * - 토스페이먼츠 결제 연동 (MVP: Edge Function 배포 전 안내 메시지)
 * - Supabase 미설정 시 테스트 충전 버튼 제공
 * - 로그인 유저에게 최근 거래 내역 표시
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Coins, ArrowLeft, Loader, CheckCircle, Clock, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProjectStore } from '../store/projectStore';
import { CREDIT_PACKS, formatKRW } from '../data/creditPacks';
import type { CreditPack } from '../data/creditPacks';
import { fetchCredits, fetchTransactions } from '../services/credit-api';
import type { DbCreditTransaction } from '../types/database';
import { isSupabaseConfigured } from '../services/supabase';

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGuest, loading: authLoading } = useAuth();
  const { credits: storeCredits, addCredits: addCreditsStore } = useProjectStore();

  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<DbCreditTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // 로그인 유저의 잔액 + 거래 내역 로드
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    setTxLoading(true);
    Promise.all([
      fetchCredits(user.id),
      fetchTransactions(user.id, 10),
    ])
      .then(([balance, txList]) => {
        setLiveBalance(balance);
        setTransactions(txList);
      })
      .catch((err) => {
        console.error('[PaymentPage] 데이터 로드 실패:', err);
      })
      .finally(() => setTxLoading(false));
  }, [user]);

  /** 크레딧 팩 구매 핸들러 (MVP: 토스 SDK 미설치 안내) */
  const handlePurchase = async (pack: CreditPack) => {
    if (!user) return;
    setPurchasingId(pack.id);
    try {
      // MVP 안내 메시지
      // 실제 연동 시:
      //   const orderId = await createOrder({ userId: user.id, creditAmount: pack.credits, amount: pack.priceKRW, gateway: 'toss' });
      //   const toss = await loadTossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY);
      //   await toss.requestPayment('카드', { amount: pack.priceKRW, orderId, orderName: `${pack.name} 팩` });
      alert(
        `${pack.name} 팩 (${pack.credits} 크레딧, ${formatKRW(pack.priceKRW)})\n\n토스페이먼츠 연동 후 결제가 활성화됩니다.\n(Edge Function 배포 필요)`
      );
    } catch (err) {
      console.error('[PaymentPage] 결제 실패:', err);
    } finally {
      setPurchasingId(null);
    }
  };

  /** 테스트 충전 (Supabase 미설정 또는 개발 모드) */
  const handleTestTopup = (amount: number) => {
    addCreditsStore(amount);
    setLiveBalance((prev) => (prev !== null ? prev + amount : amount));
  };

  // 현재 표시할 잔액: Supabase 연결 시 liveBalance, 아니면 storeCredits
  const displayBalance = liveBalance !== null ? liveBalance : storeCredits;

  if (authLoading) {
    return (
      <div className="payment-page payment-page--loading">
        <Loader size={24} className="spin-icon" />
        <p>인증 확인 중...</p>
      </div>
    );
  }

  return (
    <div className="payment-page">
      {/* 헤더 */}
      <div className="payment-page__header">
        <button className="btn-ghost payment-page__back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          뒤로
        </button>
        <h1 className="payment-page__title">
          <CreditCard size={22} />
          크레딧 충전
        </h1>
      </div>

      {/* 현재 잔액 */}
      <div className="payment-page__balance">
        <div className="payment-balance-card">
          <div className="payment-balance-card__label">
            <Coins size={16} />
            현재 크레딧 잔액
          </div>
          <div className="payment-balance-card__amount">{displayBalance.toLocaleString()}</div>
          <div className="payment-balance-card__sub">크레딧</div>
        </div>
      </div>

      {/* Supabase 미설정 안내 */}
      {!isSupabaseConfigured && (
        <div className="payment-notice payment-notice--dev">
          <CheckCircle size={16} />
          <div>
            <strong>개발 모드</strong> — Supabase 연결 후 실 결제가 활성화됩니다.
            <br />
            지금은 테스트 충전으로 크레딧을 추가할 수 있습니다.
          </div>
          <div className="payment-notice__actions">
            <button className="btn-secondary" onClick={() => handleTestTopup(100)}>
              +100 충전
            </button>
            <button className="btn-secondary" onClick={() => handleTestTopup(500)}>
              +500 충전
            </button>
          </div>
        </div>
      )}

      {/* 로그인 필요 안내 (Supabase 설정 O + 게스트) */}
      {isSupabaseConfigured && isGuest && (
        <div className="payment-notice payment-notice--login">
          <CreditCard size={16} />
          <div>
            <strong>로그인이 필요합니다</strong>
            <br />
            크레딧 충전 및 결제 내역 확인은 로그인 후 이용 가능합니다.
          </div>
          <button className="btn-primary" onClick={() => navigate('/settings')}>
            로그인하러 가기
          </button>
        </div>
      )}

      {/* 크레딧 팩 목록 */}
      <section className="payment-section">
        <h2 className="payment-section__title">크레딧 팩 선택</h2>
        <div className="payment-packs">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`payment-pack-card${pack.popular ? ' payment-pack-card--popular' : ''}`}
            >
              {pack.popular && (
                <div className="payment-pack-card__popular-badge">
                  <Star size={11} />
                  인기
                </div>
              )}
              <div className="payment-pack-card__name">{pack.name}</div>
              <div className="payment-pack-card__credits">
                {pack.credits.toLocaleString()}
                <span className="payment-pack-card__credits-unit">크레딧</span>
              </div>
              <div className="payment-pack-card__price">{formatKRW(pack.priceKRW)}</div>
              <div className="payment-pack-card__price-usd">${pack.priceUSD}</div>
              <button
                className={`payment-pack-card__buy-btn${pack.popular ? ' btn-primary' : ' btn-secondary'}`}
                disabled={
                  purchasingId === pack.id ||
                  (isSupabaseConfigured && (isGuest || !user))
                }
                onClick={() => {
                  if (!isSupabaseConfigured) {
                    handleTestTopup(pack.credits);
                  } else {
                    handlePurchase(pack);
                  }
                }}
              >
                {purchasingId === pack.id ? (
                  <>
                    <Loader size={14} className="spin-icon" />
                    처리 중...
                  </>
                ) : !isSupabaseConfigured ? (
                  '테스트 충전'
                ) : (
                  '토스로 결제'
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 거래 내역 (로그인 유저만) */}
      {isSupabaseConfigured && user && (
        <section className="payment-section payment-transactions">
          <h2 className="payment-section__title">
            <Clock size={16} />
            최근 거래 내역
          </h2>
          {txLoading ? (
            <div className="payment-transactions__loading">
              <Loader size={16} className="spin-icon" />
              로드 중...
            </div>
          ) : transactions.length === 0 ? (
            <div className="payment-transactions__empty">거래 내역이 없습니다.</div>
          ) : (
            <ul className="payment-transactions__list">
              {transactions.map((tx) => (
                <li key={tx.id} className="payment-tx-row">
                  <div className="payment-tx-row__left">
                    <span className="payment-tx-row__type">
                      {tx.type === 'purchase'
                        ? '크레딧 구매'
                        : tx.type === 'spend'
                        ? '크레딧 소비'
                        : tx.type}
                    </span>
                    {tx.description && (
                      <span className="payment-tx-row__desc">{tx.description}</span>
                    )}
                  </div>
                  <div className="payment-tx-row__right">
                    <span
                      className={`payment-tx-row__amount ${
                        tx.amount > 0
                          ? 'payment-tx-row__amount--positive'
                          : 'payment-tx-row__amount--negative'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                    <span className="payment-tx-row__balance">잔액 {tx.balance_after}</span>
                    <span className="payment-tx-row__date">
                      {new Date(tx.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 하단 뒤로가기 */}
      <div className="payment-page__footer">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} />
          뒤로 가기
        </button>
      </div>
    </div>
  );
};

export default PaymentPage;
