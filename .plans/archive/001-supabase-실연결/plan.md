# 001 Supabase 실연결 — 구현 계획 + 결과

> 날짜: 2026-02-27
> 상태: ✅ 완료

---

## 목표
`.env` 파일을 설정하고 실제 Supabase 프로젝트와 연결하여 로그인 → DB 저장/로드를 검증.

## 사전 작업 (사용자)
- ✅ Supabase 프로젝트 생성 (Seoul 리전)
- ✅ DB 테이블 생성 (SQL 마이그레이션, RLS, 트리거)
- ✅ Google OAuth 설정 (Google Cloud Console + Supabase Provider)
- ✅ Site URL + Redirect URL 설정

## 구현 사항

### Phase 1: .env 파일 생성 ✅
- `.env` 파일에 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` 설정
- AI providers 모두 mock 유지

### Phase 2: 개발 서버 + 연결 확인 ✅
- Supabase 경고 메시지 없음
- NavBar에 Google/Kakao 로그인 버튼 표시

### Phase 3: E2E 테스트 ✅
- Google 로그인 성공
- DB 저장/로드 확인
- 새로고침 후 데이터 유지
- 로그아웃 → 재로그인 → My Projects 표시

### Phase 4: 버그 수정

#### 발견된 핵심 버그: `hasActiveProject` 미설정
- **원인**: NavBar "New Project" 링크가 `/project/idea`로 라우팅만 하고 `startNewProject()`를 호출하지 않음
- **증상**: `hasActiveProject: false`여서 `useProject.ts`의 자동 저장이 실행되지 않음
- **수정**: IdeaPage에 `useEffect`로 마운트 시 자동 `startNewProject()` 호출 추가

#### 추가 수정
- `useAuth.ts`: 로그인 실패 시 `alert()` 추가
- `projectStore.ts`: AssetCard, Scene의 status에 `'failed'` 추가 (DB 타입과 일치)

## 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `.env` | 새로 생성 — Supabase credentials |
| `src/pages/IdeaPage.tsx` | hasActiveProject 자동 설정 useEffect 추가 |
| `src/hooks/useAuth.ts` | 로그인 실패 alert 추가 |
| `src/store/projectStore.ts` | status 타입에 'failed' 추가 |
| `.claude/launch.json` | Vite --host 127.0.0.1 추가 (preview 도구 호환) |

## 빌드 결과
- `npm run build` 성공 ✅ (TypeScript 에러 없음)
