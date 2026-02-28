/**
 * Supabase Database 타입 정의
 *
 * 이 파일은 Supabase DB 스키마에 대응하는 TypeScript 타입입니다.
 * Supabase CLI로 자동 생성할 수도 있지만, MVP 단계에서는 수동 관리합니다.
 *
 * 테이블 구조:
 *   users         — 사용자 프로필
 *   projects      — 영상 프로젝트
 *   scenes        — 프로젝트별 씬
 *   asset_cards   — 캐릭터/배경/아이템 카드
 *   generations   — AI 생성 작업 이력
 */

export type AssetType = 'character' | 'background' | 'item';
export type GenerationStatus = 'pending' | 'generating' | 'done' | 'failed';
export type GenerationType = 'image' | 'video' | 'script';

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;                      // UUID (auth.uid)
                    email: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    plan: 'free' | 'pro' | 'enterprise';
                    credits_remaining: number;        // 월간 생성 크레딧
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['users']['Insert']>;
            };

            projects: {
                Row: {
                    id: string;                      // UUID
                    user_id: string;                 // FK → users.id
                    title: string;
                    description: string | null;
                    selected_style: string;
                    aspect_ratio: '16:9' | '9:16' | '1:1';
                    status: 'draft' | 'in_progress' | 'completed';
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['projects']['Insert']>;
            };

            scenes: {
                Row: {
                    id: string;                      // UUID
                    project_id: string;              // FK → projects.id
                    scene_order: number;             // 씬 순서 (0-based)
                    text: string;                    // 대본 텍스트
                    location: string;
                    camera_angle: string;
                    image_prompt: string | null;
                    video_prompt: string | null;
                    image_url: string | null;
                    video_url: string | null;
                    video_count: number;             // 이 씬의 영상 수 (1~3)
                    seed_card_ids: string[];          // 이 씬에 배정된 카드 ID 배열
                    status: GenerationStatus;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['scenes']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['scenes']['Insert']>;
            };

            asset_cards: {
                Row: {
                    id: string;                      // UUID
                    user_id: string;                 // FK → users.id (카드 소유자)
                    name: string;
                    type: AssetType;
                    description: string;
                    image_url: string | null;
                    seed: number;
                    status: GenerationStatus;
                    source: 'ai' | 'manual';
                    is_favorite: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['asset_cards']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['asset_cards']['Insert']>;
            };

            generations: {
                Row: {
                    id: string;                      // UUID
                    user_id: string;                 // FK → users.id
                    project_id: string | null;       // FK → projects.id (nullable)
                    scene_id: string | null;         // FK → scenes.id (nullable)
                    type: GenerationType;
                    prompt: string;
                    result_url: string | null;
                    status: GenerationStatus;
                    provider: string;                // 예: 'replicate', 'fal', 'runway'
                    cost_credits: number;            // 소비된 크레딧
                    metadata: Record<string, unknown> | null;  // 추가 메타 (모델명, 파라미터 등)
                    created_at: string;
                    completed_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['generations']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['generations']['Insert']>;
            };
        };
    };
}

// ── 편의 타입 별칭 ──
export type DbUser = Database['public']['Tables']['users']['Row'];
export type DbProject = Database['public']['Tables']['projects']['Row'];
export type DbScene = Database['public']['Tables']['scenes']['Row'];
export type DbAssetCard = Database['public']['Tables']['asset_cards']['Row'];
export type DbGeneration = Database['public']['Tables']['generations']['Row'];

// ── 결제 시스템 타입 ──
export type CreditTransactionType = 'purchase' | 'spend' | 'refund' | 'signup_bonus' | 'admin_grant';
export type PaymentGateway = 'stripe' | 'toss';
export type OrderStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface DbUserCredits {
  user_id: string;
  balance: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  updated_at: string;
}

export interface DbCreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: CreditTransactionType;
  description: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface DbOrder {
  id: string;
  order_id: string;
  user_id: string;
  credit_amount: number;
  amount: number;
  payment_gateway: PaymentGateway;
  status: OrderStatus;
  created_at: string;
  completed_at: string | null;
}
