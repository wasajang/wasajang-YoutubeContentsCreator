# 브라우저 자동화 LLM에게 줄 프롬프트

> 아래 프롬프트를 브라우저 제어 가능한 LLM (예: Claude Computer Use, Browser Use 등)에 그대로 복사하여 사용하세요.

---

## 프롬프트 시작

당신은 Supabase 프로젝트를 설정하는 작업을 수행합니다. 아래 단계를 순서대로 실행하세요.

### STEP 1: Supabase 프로젝트 생성
1. https://supabase.com 에 접속하여 로그인하세요 (GitHub 계정 사용 가능)
2. 대시보드에서 "New Project" 클릭
3. 아래 정보로 프로젝트 생성:
   - Organization: 기존 것 선택 (없으면 새로 만들기)
   - Project name: `antigravity`
   - Database Password: 강력한 비밀번호 생성 (기록해두세요)
   - Region: `Northeast Asia (Seoul)` 선택
   - Pricing Plan: Free tier
4. "Create new project" 클릭
5. 프로젝트 생성 완료될 때까지 대기 (1~2분)

### STEP 2: API 키 복사
1. 좌측 메뉴에서 ⚙️ "Project Settings" 클릭
2. "API" 탭 클릭
3. 아래 두 값을 복사하여 기록:
   - **Project URL**: `https://xxxxx.supabase.co` 형태
   - **anon public** 키: `eyJhbGci...` 로 시작하는 긴 문자열
4. 이 두 값을 사용자에게 전달하세요

### STEP 3: 데이터베이스 스키마 생성
1. 좌측 메뉴에서 "SQL Editor" 클릭
2. "New Query" 클릭
3. 아래 SQL을 전체 복사하여 붙여넣기 후 "Run" 클릭:

```sql
-- ── 1. users 테이블 (프로필) ──
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    credits_remaining INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. projects 테이블 ──
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Project',
    description TEXT,
    selected_style TEXT NOT NULL DEFAULT 'Cinematic',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. scenes 테이블 ──
CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    scene_order INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    camera_angle TEXT NOT NULL DEFAULT 'Wide Angle',
    image_prompt TEXT,
    video_prompt TEXT,
    image_url TEXT,
    video_url TEXT,
    video_count INTEGER NOT NULL DEFAULT 1 CHECK (video_count BETWEEN 1 AND 3),
    seed_card_ids TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'done', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. asset_cards 테이블 ──
CREATE TABLE IF NOT EXISTS public.asset_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('character', 'background', 'item')),
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    seed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'done', 'failed')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. generations 테이블 (AI 생성 이력) ──
CREATE TABLE IF NOT EXISTS public.generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'script')),
    prompt TEXT NOT NULL,
    result_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'done', 'failed')),
    provider TEXT NOT NULL DEFAULT 'mock',
    cost_credits INTEGER NOT NULL DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- ── 인덱스 ──
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON public.scenes(project_id, scene_order);
CREATE INDEX IF NOT EXISTS idx_asset_cards_user_id ON public.asset_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_cards_type ON public.asset_cards(user_id, type);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON public.generations(project_id);

-- ── RLS (Row Level Security) 정책 ──
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "projects_select_own" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "scenes_select_own" ON public.scenes FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "scenes_insert_own" ON public.scenes FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "scenes_update_own" ON public.scenes FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "scenes_delete_own" ON public.scenes FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "cards_select_own" ON public.asset_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cards_insert_own" ON public.asset_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cards_update_own" ON public.asset_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cards_delete_own" ON public.asset_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "gens_select_own" ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gens_insert_own" ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 자동 updated_at 트리거 ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scenes_updated_at BEFORE UPDATE ON public.scenes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_asset_cards_updated_at BEFORE UPDATE ON public.asset_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 사용자 생성 시 자동 프로필 생성 ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

4. 실행 후 "Success" 메시지 확인

### STEP 4: Google OAuth 설정
1. 좌측 메뉴 "Authentication" 클릭
2. "Providers" 탭 클릭
3. "Google" 찾아서 클릭하여 펼치기
4. "Enable Sign in with Google" 토글을 ON으로 변경
5. 여기서 일단 멈추세요 — Google Cloud Console에서 OAuth 클라이언트를 먼저 만들어야 합니다:
   - https://console.cloud.google.com 접속
   - 프로젝트 선택 (없으면 "AntiGravity" 이름으로 새로 생성)
   - "API 및 서비스" → "사용자 인증 정보" → "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
   - 동의 화면이 미설정이면: "OAuth 동의 화면" → "External" → 앱 이름 "AntiGravity", 필수 필드만 입력 후 저장
   - 다시 "사용자 인증 정보 만들기" → "OAuth 클라이언트 ID"
   - 애플리케이션 유형: "웹 애플리케이션"
   - 이름: "AntiGravity Web"
   - 승인된 JavaScript 원본: `http://localhost:5173`
   - 승인된 리디렉션 URI: Supabase 대시보드의 Authentication > Providers > Google 섹션에 표시된 "Callback URL (for OAuth)" 값을 여기에 입력 (보통 `https://xxxxx.supabase.co/auth/v1/callback` 형태)
   - "만들기" 클릭
   - 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사
6. Supabase 대시보드로 돌아와서:
   - Client ID에 위에서 복사한 클라이언트 ID 붙여넣기
   - Client Secret에 클라이언트 보안 비밀번호 붙여넣기
   - "Save" 클릭

### STEP 5: Site URL 설정
1. Supabase 대시보드 → Authentication → URL Configuration
2. Site URL: `http://localhost:5173`
3. Redirect URLs에 추가: `http://localhost:5173/**`
4. Save 클릭

### 완료 확인 체크리스트
- [ ] 프로젝트 생성됨 (Seoul 리전)
- [ ] SQL 실행 성공 (5개 테이블 + RLS + 트리거)
- [ ] Project URL 복사됨
- [ ] anon key 복사됨
- [ ] Google OAuth 설정 완료
- [ ] Site URL = http://localhost:5173
- [ ] Redirect URLs에 http://localhost:5173/** 추가됨

### 사용자에게 전달할 값 (반드시!)
1. **VITE_SUPABASE_URL** = `https://xxxxx.supabase.co`
2. **VITE_SUPABASE_ANON_KEY** = `eyJhbGci...`

## 프롬프트 끝
