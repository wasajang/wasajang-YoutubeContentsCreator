# 013 UX 버그 수정 + 기능 보완 — 구현 계획

> 작성: CTO 일론 (2026-03-02)
> 상태: CEO 검토 대기
> 근거: CEO 브라우저 테스트 피드백 6건 + CPO 유나 시나리오 점검

---

## 수정 항목 요약

| # | 문제 (화면 기준) | 수정 내용 |
|---|------------------|----------|
| 1 | 홈에서 템플릿 선택 시 씬 개수/AI 모델 미적용 | HomePage에서 누락된 설정 2개 추가 |
| 2 | 아이디어 페이지 씬 분할 시 씬 개수가 항상 10 | 템플릿 선택 시 씬 개수 자동 반영 |
| 3 | 스토리보드 AI 분석 팝업에 템플릿 정보 미전달 | 카드 덱 선택 화면에서 템플릿 데이터 연결 |
| 4 | 나레이션 AI 팝업에 "카드 X개 추천" 안내 없음 | 팝업 메시지에 구체적 숫자 표시 |
| 5 | 생성 단계에 프롬프트 편집 기능 없음 | 프롬프트 확인/편집 UI 추가 |
| 6 | 영상 생성 후 미리보기 칸 없음 | 영상 URL 저장 + 미리보기 행 추가 |

---

## Phase 1: 데이터 연결 버그 수정 (#1, #2, #3, #4)

### 1-1. HomePage 템플릿 선택 시 누락 설정 추가

**파일:** `src/pages/HomePage.tsx` (handleTemplateCardSelect 함수)

```tsx
// 현재 (109-116행)
const handleTemplateCardSelect = (template: Template) => {
    startNewProject(template.name, template.mode);
    setEntryPoint('style');
    setTemplateId(template.id);
    setArtStyleId(template.artStyleId);
    setAspectRatio(template.aspectRatio);
    navigate('/project/idea');
};

// 수정 후 — 2줄 추가
const handleTemplateCardSelect = (template: Template) => {
    startNewProject(template.name, template.mode);
    setEntryPoint('style');
    setTemplateId(template.id);
    setArtStyleId(template.artStyleId);
    setAspectRatio(template.aspectRatio);
    // ✅ 추가: AI 모델 프리셋 적용
    if (template.defaultModels) {
        Object.entries(template.defaultModels).forEach(([category, modelId]) => {
            setAiModelPreference(category as 'script' | 'image' | 'video' | 'tts', modelId);
        });
    }
    navigate('/project/idea');
};
```

**참고:** sceneCount는 IdeaPage 로컬 state이므로 여기서 설정 불가 → 1-2에서 처리

### 1-2. IdeaPage 씬 개수 초기화 — 템플릿 반영

**파일:** `src/pages/IdeaPage.tsx`

```tsx
// 현재 (91행)
const [sceneCount, setSceneCount] = useState(10);

// 수정 후 — 템플릿의 기본 씬 개수로 초기화
const [sceneCount, setSceneCount] = useState(() => {
    if (templateId) {
        const tmpl = getTemplateById(templateId);
        return tmpl?.promptRules?.sceneSplitRules?.defaultSceneCount ?? 10;
    }
    return 10;
});
```

### 1-3. AiAnalysisModal에 템플릿 정보 전달

**문제:** CastSetupPhase → AiAnalysisModal로 templateId/castPreset이 전달되지 않음

**파일 1:** `src/pages/StoryboardPage.tsx` — CastSetupPhase에 template 관련 props 전달

```tsx
// 현재: CastSetupPhase에 templateId 미전달
// StoryboardPage에서 이미 template 정보를 가지고 있음 (66행)

// CastSetupPhase 호출부에 props 추가 (정확한 위치는 구현 시 확인)
<CastSetupPhase
    ...
    templateId={templateId}
    templateName={templateId ? getTemplateById(templateId)?.name : undefined}
    castPreset={templateId ? getTemplateById(templateId)?.castPreset : undefined}
/>
```

**파일 2:** `src/components/storyboard/CastSetupPhase.tsx` — props 받아서 AiAnalysisModal로 전달

```tsx
// CastSetupPhase interface에 추가
interface CastSetupPhaseProps {
    ...
    templateId?: string | null;
    templateName?: string;
    castPreset?: { characters: any[]; backgrounds: any[]; items: any[] };
}

// AiAnalysisModal 렌더링 부분
<AiAnalysisModal
    isAnalyzing={isAiAnalyzing}
    onAnalyze={onAiAnalysis}
    templateId={templateId}          // ✅ 추가
    templateName={templateName}      // ✅ 추가
    castPreset={castPreset}          // ✅ 추가
/>
```

### 1-4. AiAnalysisModal 메시지에 구체적 카드 개수 표시

**파일:** `src/components/storyboard/AiAnalysisModal.tsx`

```tsx
// 현재 (41-42행): "자동 추천합니다"
// 수정: 구체적 숫자 표시

{hasTemplate ? (
    <>
        <h3>'{templateName}' 템플릿 카드 추천</h3>
        <p>
            캐릭터 {castPreset!.characters.length}명,
            배경 {castPreset!.backgrounds.length}개,
            아이템 {castPreset!.items.length}개를 자동 추출/추천합니다.
        </p>
        {/* 기존 미리보기 카드 유지 */}
    </>
) : (
    <>
        <h3>AI 대본 분석</h3>
        <p>대본을 분석하여 캐릭터 3명, 배경 1개, 아이템 1개를 자동 추출합니다.</p>
    </>
)}
```

---

## Phase 2: 프롬프트 편집 기능 (#5)

### 2-1. SeedCheckPhase에 프롬프트 편집 UI 추가

**방식:** 별도 단계 추가 대신, 기존 SeedCheckPhase 내에서 "프롬프트 확인/편집" 섹션을 이미지 생성 버튼 위에 배치

**파일:** `src/hooks/useGeneration.ts` — 프롬프트 상태 관리 추가

```tsx
// useGeneration에 추가
const [customPrompts, setCustomPrompts] = useState<Record<string, { image: string; video: string }>>({});

// 프롬프트 초기 생성 함수
const initPrompts = useCallback(() => {
    const prompts: Record<string, { image: string; video: string }> = {};
    scenes.forEach((scene) => {
        const seeds = sceneSeeds[scene.id] || [];
        const seedCards = deck.filter((c) => seeds.includes(c.id));
        prompts[scene.id] = {
            image: buildImagePrompt({ scene, deck: seedCards, artStyleId, templateId }),
            video: buildVideoPrompt({ scene, deck: seedCards, artStyleId, templateId }),
        };
    });
    setCustomPrompts(prompts);
}, [scenes, sceneSeeds, deck, artStyleId, templateId]);

// 커스텀 프롬프트 업데이트
const updatePrompt = useCallback((sceneId: string, type: 'image' | 'video', value: string) => {
    setCustomPrompts(prev => ({
        ...prev,
        [sceneId]: { ...prev[sceneId], [type]: value }
    }));
}, []);

// generateSingleScene에서 customPrompts 우선 사용
// 기존: buildImagePrompt 직접 호출
// 수정: customPrompts[sceneId]?.image || buildImagePrompt(...)
```

**파일:** `src/components/storyboard/SeedCheckPhase.tsx` — 프롬프트 편집 UI

```tsx
// 기존 "일괄 이미지 생성" 버튼 위에 배치
{/* 프롬프트 확인/편집 */}
<div className="sc-prompt-section">
    <div className="sc-prompt-section__header">
        <h4>프롬프트 확인</h4>
        <button onClick={genApi.initPrompts} className="btn-secondary btn-sm">
            프롬프트 자동 생성
        </button>
    </div>
    {scenes.map((scene, index) => (
        <div key={scene.id} className="sc-prompt-row">
            <span className="sc-prompt-row__label">씬 {index + 1}</span>
            <textarea
                className="sc-prompt-row__input"
                value={genApi.customPrompts[scene.id]?.image || ''}
                onChange={(e) => genApi.updatePrompt(scene.id, 'image', e.target.value)}
                placeholder="이미지 프롬프트..."
                rows={2}
            />
            <textarea
                className="sc-prompt-row__input"
                value={genApi.customPrompts[scene.id]?.video || ''}
                onChange={(e) => genApi.updatePrompt(scene.id, 'video', e.target.value)}
                placeholder="영상 프롬프트..."
                rows={2}
            />
        </div>
    ))}
</div>
```

---

## Phase 3: 영상 미리보기 (#6)

### 3-1. Scene 타입에 videoUrl 추가

**파일:** `src/store/projectStore.ts`

```tsx
// 현재 (20-29행)
export interface Scene {
    id: string;
    text: string;
    location: string;
    cameraAngle: string;
    imageUrl: string;
    characters: string[];
    status: 'pending' | 'generating' | 'done' | 'failed';
    checked: boolean;
}

// 수정 — videoUrl 추가
export interface Scene {
    id: string;
    text: string;
    location: string;
    cameraAngle: string;
    imageUrl: string;
    videoUrl?: string;  // ✅ 추가
    characters: string[];
    status: 'pending' | 'generating' | 'done' | 'failed';
    checked: boolean;
}

// store actions에 추가
updateSceneVideo: (sceneId: string, videoUrl: string) =>
    set((state) => ({
        scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, videoUrl } : s
        ),
    })),
```

### 3-2. useGeneration에서 영상 URL 저장

**파일:** `src/hooks/useGeneration.ts`

```tsx
// updateSceneImage와 동일 패턴
const updateSceneVideo = useProjectStore((s) => s.updateSceneVideo);

// generateSingleVideo 함수 내부 (영상 생성 완료 후)
// 기존: setVideoGenStatus만 업데이트
// 수정: store에도 videoUrl 저장
updateSceneVideo(sceneId, result.url);
```

### 3-3. SceneFilmstrip 아래에 영상 미리보기 행 추가

**파일:** `src/components/storyboard/SeedCheckPhase.tsx`

```tsx
// SceneFilmstrip 아래에 영상 미리보기 행 추가
<SceneFilmstrip ... />

{/* 영상 미리보기 (이미지 생성 완료 후 표시) */}
{allImagesDone && (
    <div className="sc-video-filmstrip">
        <span className="sc-video-filmstrip__label">영상 미리보기</span>
        <div className="sc-video-filmstrip__list">
            {scenes.map((scene) => (
                <div key={scene.id} className="sc-video-filmstrip__item">
                    {scene.videoUrl ? (
                        <video
                            src={scene.videoUrl}
                            className="sc-video-filmstrip__video"
                            controls
                            muted
                        />
                    ) : (
                        <div className="sc-video-filmstrip__placeholder">
                            {videoGenStatus[scene.id] === 'generating' ? (
                                <Loader size={14} className="spinning" />
                            ) : (
                                <Video size={14} opacity={0.3} />
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
)}
```

---

## 수정 파일 목록

| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `src/pages/HomePage.tsx` | 1 | defaultModels 적용 추가 |
| `src/pages/IdeaPage.tsx` | 1 | sceneCount 초기화 로직 |
| `src/pages/StoryboardPage.tsx` | 1 | CastSetupPhase에 template props 전달 |
| `src/components/storyboard/CastSetupPhase.tsx` | 1 | template props 수신 → AiAnalysisModal 전달 |
| `src/components/storyboard/AiAnalysisModal.tsx` | 1 | 카드 개수 표시 메시지 |
| `src/hooks/useGeneration.ts` | 2, 3 | 프롬프트 상태 + 영상 URL 저장 |
| `src/components/storyboard/SeedCheckPhase.tsx` | 2, 3 | 프롬프트 편집 UI + 영상 미리보기 |
| `src/store/projectStore.ts` | 3 | Scene.videoUrl + updateSceneVideo |
| `src/index.css` | 2, 3 | 프롬프트 편집 + 영상 미리보기 CSS |

총 **9개 파일** 수정

---

## 구현 순서

```
Phase 1 (데이터 연결) → Phase 2 (프롬프트 편집) → Phase 3 (영상 미리보기) → 빌드 검증
```

Phase 1은 독립적인 수정 4건이므로 병렬 처리 가능.
Phase 2~3은 useGeneration 훅을 공유하므로 순차 진행.

---

*이 계획은 CEO 검토/주석 후 구현을 시작합니다.*
