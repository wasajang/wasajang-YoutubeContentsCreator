export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceKRW: number;
  priceUSD: number;
  stripePriceId?: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter',    name: 'Starter',    credits: 100,  priceKRW: 4900,   priceUSD: 3.99 },
  { id: 'pro',        name: 'Pro',        credits: 500,  priceKRW: 19900,  priceUSD: 14.99, popular: true },
  { id: 'enterprise', name: 'Enterprise', credits: 1500, priceKRW: 49900,  priceUSD: 37.99 },
];

export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}
