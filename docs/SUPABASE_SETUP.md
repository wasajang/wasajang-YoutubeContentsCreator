# Supabase 설정 가이드

> AntiGravity 프로젝트에 Supabase를 연결하는 단계별 가이드입니다.
> Supabase 없이도 **게스트 모드**로 모든 기능을 사용할 수 있습니다.

---

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에 접속하여 무료 계정을 만듭니다.
2. **New Project** 버튼을 클릭합니다.
3. 프로젝트 이름, 데이터베이스 비밀번호, 리전(서울 권장)을 설정하고 생성합니다.
4. 프로젝트가 생성되면 대시보드로 이동합니다.

---

## 2. 데이터베이스 스키마 생성

1. Supabase 대시보드에서 좌측 메뉴 **SQL Editor**를 클릭합니다.
2. **New Query** 버튼을 클릭합니다.
3. 프로젝트의 `supabase/migrations/001_initial_schema.sql` 파일 내용을 복사하여 붙여넣습니다.
4. **Run** 버튼을 클릭하여 실행합니다.
5. 성공 메시지가 나오면 완료입니다.

### 생성되는 테이블

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 프로필 (auth.users와 자동 연동) |
| `projects` | 영상 프로젝트 |
| `scenes` | 프로젝트별 씬 (대본, 이미지, 영상) |
| `asset_cards` | 캐릭터/배경/아이템 카드 라이브러리 |
| `generations` | AI 생성 작업 이력 |

---

## 3. 환경 변수 설정 (.env)

1. Supabase 대시보드 → **Settings** → **API** 페이지로 이동합니다.
2. 다음 두 가지 값을 복사합니다:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 (예: `eyJhbGci...`)

3. 프로젝트 루트의 `.env.example`을 `.env`로 복사합니다:

```bash
cp .env.example .env
```

4. `.env` 파일을 열어 다음 값을 입력합니다:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci-your-anon-key-here
```

5. 저장 후 개발 서버를 재시작합니다 (`npm run dev`).

---

## 4. 소셜 로그인 설정 (Google OAuth)

### Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com)에 접속합니다.
2. 프로젝트를 선택하거나 새로 만듭니다.
3. **API 및 서비스** → **사용자 인증 정보** → **OAuth 2.0 클라이언트 ID 만들기**
4. 애플리케이션 유형: **웹 애플리케이션**
5. **승인된 리디렉션 URI**에 다음을 추가합니다:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
6. 생성 후 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사합니다.

### Supabase에 Google OAuth 연결

1. Supabase 대시보드 → **Authentication** → **Providers**
2. **Google** 항목을 찾아 활성화합니다.
3. 위에서 복사한 Client ID와 Client Secret을 입력합니다.
4. 저장합니다.

---

## 5. 소셜 로그인 설정 (Kakao OAuth) — 선택사항

### Kakao Developers 설정

1. [Kakao Developers](https://developers.kakao.com)에 접속하여 앱을 만듭니다.
2. **앱 설정** → **플랫폼** → **Web 플랫폼 등록**
   - 사이트 도메인: `http://localhost:5173` (개발용)
3. **제품 설정** → **카카오 로그인** → **활성화**
4. **Redirect URI** 추가:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
5. **앱 키** → **REST API 키**를 복사합니다.
6. **제품 설정** → **카카오 로그인** → **보안** → **Client Secret** 생성

### Supabase에 Kakao OAuth 연결

1. Supabase 대시보드 → **Authentication** → **Providers**
2. **Kakao** 항목을 찾아 활성화합니다.
3. REST API 키(Client ID)와 Client Secret을 입력합니다.
4. 저장합니다.

---

## 6. 동작 확인 체크리스트

설정 완료 후 아래 항목을 확인해주세요:

- [ ] 앱 실행 시 콘솔에 `[Supabase] 클라이언트 초기화 완료` 메시지가 나옴
- [ ] NavBar에 "Google" / "Kakao" 로그인 버튼이 표시됨 (게스트 뱃지 대신)
- [ ] 로그인 후 HomePage에 "My Projects" 섹션이 표시됨
- [ ] 새 프로젝트 생성 → 2초 후 DB에 자동 저장됨
- [ ] 페이지 새로고침 후 프로젝트가 복원됨
- [ ] HomePage에서 프로젝트 삭제 가능

---

## 게스트 모드 (Supabase 없이 사용)

`.env` 파일에 Supabase 값이 없으면 자동으로 **게스트 모드**로 동작합니다:

- 모든 데이터는 **localStorage**에 저장됩니다
- 인증 없이 모든 기능을 사용할 수 있습니다
- NavBar에 "게스트" 뱃지가 표시됩니다
- My Projects 섹션은 표시되지 않습니다

> 게스트 모드에서 만든 데이터는 **첫 로그인 시 자동으로 DB에 마이그레이션**됩니다.

---

## 문제 해결 (FAQ)

### "Supabase가 설정되지 않았습니다" 에러
→ `.env` 파일에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 올바르게 설정되어 있는지 확인하세요.

### 로그인 버튼을 눌러도 아무 반응이 없음
→ Supabase 대시보드에서 해당 OAuth Provider가 활성화되어 있는지 확인하세요.

### SQL 실행 시 에러 발생
→ SQL을 부분적으로 실행해보세요. 이미 존재하는 테이블이 있으면 `IF NOT EXISTS` 덕분에 무시됩니다.

### 로그인 후 데이터가 보이지 않음
→ 브라우저 콘솔(F12)에서 `[useProject]` 로그를 확인해보세요. Supabase 연결 상태와 데이터 동기화 과정이 표시됩니다.
