# 004-2 AI 파이프라인 완성 — 구현 계획

> 작성: 2026-03-06 | CTO 일론
> 목표: 가짜 카드 추천 + 랜덤 씨드 매칭 → 실제 AI 분석으로 교체

---

## 요약

| 항목 | 내용 |
|------|------|
| **수정 파일** | 3개 핵심 + 2개 소규모 |
| **신규 파일** | 0개 (기존 ai-llm.ts에 함수 추가) |
| **LLM 호출** | 1회 통합 (카드 추천 + 씬 매칭 동시) |
| **쿼터 소비** | llm 1회 (테스트 5회 중 1회) |
| **비용** | 무료 (Gemini 2.5 Flash) |
| **예상 시간** | 2시간 |

---

## 작업 단위 (총 4단계)

| 단계 | 내용 | 수정 파일 | 난이도 |
|------|------|----------|--------|
| **A** | LLM 대본 분석 함수 추가 | `ai-llm.ts` | 보통 |
| **B** | StoryboardPage 카드 추천 연동 | `StoryboardPage.tsx`, `AiAnalysisModal.tsx` | 보통 |
| **C** | 씬별 씨드 카드 AI 매칭 | `useGenerationPrompts.ts` | 보통 |
| **D** | 통합 테스트 + 빌드 확인 | — | 간단 |

---

## 단계 A: LLM 대본 분석 함수 추가

**파일:** `src/services/ai-llm.ts`

### 새 타입 정의

```typescript
// ── 대본 분석 요청/응답 타입 ──

export interface ScriptAnalysisRequest {
    /** 전체 대본 텍스트 */
    fullScript: string;
    /** 씬 목록 (ID + 텍스트) */
    scenes: Array<{ id: string; text: string }>;
    /** 기존 카드 라이브러리 (매칭 대상) */
    existingCards: Array<{
        id: string;
        name: string;
        type: 'character' | 'background' | 'item';
        description: string;
    }>;
    /** 템플릿 ID (있으면 캐스트 프리셋 참조) */
    templateId?: string;
    /** AI 모델 ID */
    model?: string;
}

export interface ScriptAnalysisResult {
    /** 추천 카드 목록 (기존 매칭 + 신규 제안) */
    recommendedCards: Array<{
        /** 기존 카드 ID (매칭된 경우) 또는 null (신규) */
        matchedCardId: string | null;
        /** 카드 이름 */
        name: string;
        /** 카드 타입 */
        type: 'character' | 'background' | 'item';
        /** 영문 시각 설명 (이미지 프롬프트용) */
        description: string;
        /** 추천 이유 (한국어) */
        reason: string;
    }>;
    /** 씬별 카드 매칭 (sceneId → cardId[]) */
    sceneMatching: Record<string, string[]>;
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}
```

### Mock Provider 구현

```typescript
// mockProvider에 analyzeScript 추가
const mockAnalyzeScript = async (req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> => {
    const start = Date.now();
    await new Promise(r => setTimeout(r, 1500));

    // 기존 카드가 있으면 그대로 추천, 없으면 기본 캐릭터 3 + 배경 1 + 아이템 1
    const recommendedCards = req.existingCards.length > 0
        ? req.existingCards.slice(0, 5).map(c => ({
            matchedCardId: c.id,
            name: c.name,
            type: c.type,
            description: c.description,
            reason: '기존 라이브러리에서 매칭됨 (Mock)',
        }))
        : [
            { matchedCardId: null, name: '주인공', type: 'character' as const, description: 'main protagonist, young adult, determined expression', reason: 'Mock 기본 캐릭터' },
            { matchedCardId: null, name: '조력자', type: 'character' as const, description: 'supporting character, wise mentor figure', reason: 'Mock 기본 캐릭터' },
            { matchedCardId: null, name: '배경', type: 'background' as const, description: 'dramatic landscape, cinematic lighting', reason: 'Mock 기본 배경' },
        ];

    // 씬별 매칭: 모든 씬에 모든 카드 배정 (Mock)
    const cardIds = recommendedCards.map((c, i) => c.matchedCardId || `new-${i}`);
    const sceneMatching: Record<string, string[]> = {};
    req.scenes.forEach(s => {
        sceneMatching[s.id] = cardIds.slice(0, Math.min(3, cardIds.length));
    });

    return {
        recommendedCards,
        sceneMatching,
        provider: 'mock',
        durationMs: Date.now() - start,
    };
};
```

### Gemini Provider 구현

```typescript
const geminiAnalyzeScript = async (req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error('Gemini API 키가 필요합니다.');

    const start = Date.now();
    const model = req.model || 'gemini-2.5-flash';

    // 기존 카드 목록 텍스트
    const existingCardsText = req.existingCards.length > 0
        ? req.existingCards.map(c =>
            `- ${c.id} [${c.type}] "${c.name}": ${c.description}`
        ).join('\n')
        : '(없음 — 모든 카드를 새로 제안해주세요)';

    // 씬 목록 텍스트
    const scenesText = req.scenes.map(s =>
        `- ${s.id}: ${s.text.substring(0, 200)}`
    ).join('\n');

    const systemPrompt = `당신은 영상 제작 AI 어시스턴트입니다.
대본을 분석하여 필요한 시각적 에셋(캐릭터, 배경, 아이템)을 추출하고,
기존 카드 라이브러리와 매칭합니다.

규칙:
1. 대본에서 주요 캐릭터(최대 5명), 배경(최대 3개), 아이템(최대 3개)을 추출
2. 기존 카드 중 의미적으로 매칭되는 것이 있으면 matchedCardId에 해당 ID 기입
3. 매칭 카드가 없으면 matchedCardId를 null로, 새 카드 정보 제안
4. description은 반드시 영문으로, 이미지 생성 AI가 사용할 구체적 시각 묘사 작성
5. reason은 한국어로 추천 이유 간략 설명
6. sceneMatching: 각 씬에 등장하는 카드의 ID 배열 (matchedCardId 또는 "new-{index}")
7. 새 카드의 ID는 "new-0", "new-1" 등으로 순서 부여

JSON 형식:
{
  "recommendedCards": [
    {
      "matchedCardId": "기존ID" | null,
      "name": "이름",
      "type": "character" | "background" | "item",
      "description": "English visual description for image generation",
      "reason": "한국어 추천 이유"
    }
  ],
  "sceneMatching": {
    "scene-1": ["cardId1", "cardId2"],
    "scene-2": ["cardId1", "new-0"]
  }
}`;

    const userPrompt = `## 대본
${req.fullScript}

## 씬 목록
${scenesText}

## 기존 카드 라이브러리
${existingCardsText}

대본을 분석하여 추천 카드와 씬별 매칭을 JSON으로 반환해주세요.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (response.status === 429) {
        throw new Error('Gemini API 요청 한도 초과 — 잠시 후 다시 시도해주세요.');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini 분석 에러: ${(err as any).error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(content);

    return {
        recommendedCards: parsed.recommendedCards || [],
        sceneMatching: parsed.sceneMatching || {},
        provider: 'gemini',
        durationMs: Date.now() - start,
    };
};
```

### Public API 함수

```typescript
/**
 * 대본 분석 — 카드 추천 + 씬별 매칭
 * LLM 쿼터 1회 소비
 */
export async function analyzeScript(req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> {
    const providerName = import.meta.env.VITE_LLM_API_PROVIDER || 'mock';

    // 쿼터 체크 (실제 provider일 때만)
    if (providerName !== 'mock' && !consumeQuota('llm')) {
        // 쿼터 초과 → Mock 분석
        return mockAnalyzeScript(req);
    }

    if (providerName === 'gemini') {
        return geminiAnalyzeScript(req);
    }

    // mock 또는 미지원 provider
    return mockAnalyzeScript(req);
}
```

---

## 단계 B: StoryboardPage 카드 추천 연동

**파일:** `src/pages/StoryboardPage.tsx`

### handleAiAnalysis 교체

```typescript
// Before: setTimeout + 하드코딩
// After: 실제 AI 호출

const handleAiAnalysis = async (doAnalysis: boolean) => {
    const template = templateId ? getTemplateById(templateId) : null;
    const castPreset = template?.castPreset;
    const castConfig = castPreset
        ? {
            characters: castPreset.characters.length,
            backgrounds: castPreset.backgrounds.length,
            items: castPreset.items.length,
        }
        : { characters: 3, backgrounds: 1, items: 1 };

    if (!doAnalysis) {
        // 기존 로직 유지: 기본 카드 사용
        // 템플릿 castPreset이 있으면 프리셋 카드로, 없으면 빈 덱
        if (castPreset) {
            const presetCards: AssetCard[] = [
                ...castPreset.characters.map((c, i) => ({
                    id: `preset-char-${i}`,
                    name: c.name,
                    type: 'character' as const,
                    description: c.description,
                    imageUrl: c.referenceImageUrl || '',
                    seed: Math.floor(Math.random() * 99999),
                    status: 'pending' as const,
                    isRequired: c.isRequired,
                    source: 'template' as const,
                })),
                ...castPreset.backgrounds.map((c, i) => ({
                    id: `preset-bg-${i}`,
                    name: c.name,
                    type: 'background' as const,
                    description: c.description,
                    imageUrl: c.referenceImageUrl || '',
                    seed: Math.floor(Math.random() * 99999),
                    status: 'pending' as const,
                    isRequired: c.isRequired,
                    source: 'template' as const,
                })),
                ...castPreset.items.map((c, i) => ({
                    id: `preset-item-${i}`,
                    name: c.name,
                    type: 'item' as const,
                    description: c.description,
                    imageUrl: c.referenceImageUrl || '',
                    seed: Math.floor(Math.random() * 99999),
                    status: 'pending' as const,
                    isRequired: c.isRequired,
                    source: 'template' as const,
                })),
            ];
            presetCards.forEach(c => addToCardLibrary(c));
            deckApi.setDeck(presetCards);
        }
        setShowAiAnalysisModal(false);
        return;
    }

    // AI 분석 시작
    setIsAiAnalyzing(true);

    try {
        const fullScript = scenes.map(s => s.text).join('\n\n');
        const result = await analyzeScript({
            fullScript,
            scenes: scenes.map(s => ({ id: s.id, text: s.text })),
            existingCards: cardLibrary.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                description: c.description,
            })),
            templateId: templateId || undefined,
        });

        // 분석 결과 → 카드 변환
        const analysisCards: AssetCard[] = result.recommendedCards.map((rec, i) => {
            if (rec.matchedCardId) {
                // 기존 카드 매칭됨
                const existing = cardLibrary.find(c => c.id === rec.matchedCardId);
                if (existing) {
                    return { ...existing, isRequired: true, source: 'ai' as const };
                }
            }
            // 신규 카드 생성
            return {
                id: rec.matchedCardId || `ai-new-${i}`,
                name: rec.name,
                type: rec.type,
                description: rec.description,
                imageUrl: '',
                seed: Math.floor(Math.random() * 99999),
                status: 'pending' as const,
                isRequired: true,
                source: 'ai' as const,
            };
        });

        // 덱 설정
        analysisCards.forEach(c => addToCardLibrary(c));
        deckApi.setDeck(analysisCards);

        // 씬별 매칭 결과 저장 (단계 C에서 사용)
        // sceneMatching에서 "new-N" → 실제 카드 ID로 변환
        const idMapping: Record<string, string> = {};
        result.recommendedCards.forEach((rec, i) => {
            const cardId = rec.matchedCardId || `ai-new-${i}`;
            idMapping[`new-${i}`] = cardId;
            if (rec.matchedCardId) idMapping[rec.matchedCardId] = rec.matchedCardId;
        });

        const resolvedSeeds: Record<string, string[]> = {};
        Object.entries(result.sceneMatching).forEach(([sceneId, cardIds]) => {
            resolvedSeeds[sceneId] = cardIds.map(id => idMapping[id] || id);
        });

        genApi.setSceneSeeds(prev => ({ ...prev, ...resolvedSeeds }));

        console.log('[AI Analysis] 완료:', {
            추천카드: analysisCards.length,
            씬매칭: Object.keys(resolvedSeeds).length,
            provider: result.provider,
            소요시간: `${result.durationMs}ms`,
        });

    } catch (err) {
        console.error('[AI Analysis] 에러:', err);
        // 에러 시 기본 카드 사용 (기존 폴백)
        const fallbackCards = aiSuggestedCards.slice(0, 5).map(c => ({
            ...c, source: 'ai' as const,
        }));
        fallbackCards.forEach(c => addToCardLibrary(c));
        deckApi.setDeck(fallbackCards);

        // 토스트로 에러 알림
        // (토스트 시스템 연동)
    } finally {
        setIsAiAnalyzing(false);
        setShowAiAnalysisModal(false);
    }
};
```

### AiAnalysisModal 수정

**파일:** `src/components/storyboard/AiAnalysisModal.tsx`

변경사항:
- "실제 AI 프롬프트는 추후 입력 예정입니다" 문구 제거
- 분석 중 상태에 진행 텍스트 추가: "대본을 분석하고 있습니다... (약 5-10초)"

---

## 단계 C: 씬별 씨드 카드 AI 매칭

**파일:** `src/hooks/useGenerationPrompts.ts`

### initPrompts 수정

```typescript
// Before: assignRandom() — Math.random으로 랜덤 배정
// After: AI 분석 결과가 있으면 사용, 없으면 스마트 폴백

const initPrompts = useCallback(() => {
    const chars = deck.filter(c => c.type === 'character');
    const bgs = deck.filter(c => c.type === 'background');
    const items = deck.filter(c => c.type === 'item');

    // ── 씬 씨드 업데이트 ──
    const updatedSeeds = { ...storeSceneSeeds };

    scenes.forEach(scene => {
        const vc = videoCountPerScene[scene.id] || 1;

        // 이미 AI가 매칭한 결과가 있으면 그대로 사용
        if (updatedSeeds[scene.id] && updatedSeeds[scene.id].length > 0) {
            // AI 또는 사용자가 이미 설정함 → 유지
            // 서브씬에 전파
            if (vc > 1) {
                for (let sub = 0; sub < vc; sub++) {
                    const subKey = `${scene.id}-${sub}`;
                    if (!updatedSeeds[subKey] || updatedSeeds[subKey].length === 0) {
                        updatedSeeds[subKey] = [...updatedSeeds[scene.id]];
                    }
                }
            }
            return; // 이 씬은 스킵
        }

        // AI 매칭 결과가 없는 경우 → 스마트 폴백
        // (씬 텍스트에서 카드 이름 키워드 매칭)
        const assignSmart = (): string[] => {
            const assigned: string[] = [];
            const sceneTextLower = scene.text.toLowerCase();

            // 1. 키워드 매칭: 카드 이름이 씬 텍스트에 포함되어 있으면 선택
            chars.forEach(c => {
                if (sceneTextLower.includes(c.name.toLowerCase()) ||
                    c.name.split(/[(/]/).some(part =>
                        sceneTextLower.includes(part.trim().toLowerCase())
                    )) {
                    assigned.push(c.id);
                }
            });

            // 캐릭터가 없으면 첫 번째 캐릭터 배정 (주인공 가정)
            if (assigned.length === 0 && chars.length > 0) {
                assigned.push(chars[0].id);
            }

            // 2. 배경: 키워드 매칭 또는 첫 번째
            const matchedBg = bgs.find(c =>
                sceneTextLower.includes(c.name.toLowerCase())
            );
            if (matchedBg) {
                assigned.push(matchedBg.id);
            } else if (bgs.length > 0) {
                assigned.push(bgs[0].id);
            }

            // 3. 아이템: 키워드 매칭만 (없으면 생략)
            items.forEach(c => {
                if (sceneTextLower.includes(c.name.toLowerCase())) {
                    assigned.push(c.id);
                }
            });

            return assigned;
        };

        if (vc <= 1) {
            updatedSeeds[scene.id] = assignSmart();
        } else {
            for (let sub = 0; sub < vc; sub++) {
                const subKey = `${scene.id}-${sub}`;
                if (!updatedSeeds[subKey] || updatedSeeds[subKey].length === 0) {
                    updatedSeeds[subKey] = sub === 0
                        ? assignSmart()
                        : [...(updatedSeeds[`${scene.id}-0`] || [])];
                }
            }
            updatedSeeds[scene.id] = updatedSeeds[`${scene.id}-0`] || [];
        }
    });

    setSceneSeeds(updatedSeeds);
    setStoreSceneSeeds(updatedSeeds);

    // ── 프롬프트 생성 (기존 로직 유지) ──
    // ... (변경 없음)
}, [/* deps */]);
```

### 핵심 변경점

| 항목 | Before | After |
|------|--------|-------|
| 씨드 배정 방식 | `Math.random()` 셔플 | AI 결과 우선 → 키워드 매칭 폴백 |
| 대본 내용 참조 | 안 함 | `scene.text`에서 카드 이름 검색 |
| AI 결과 활용 | 없음 | `storeSceneSeeds`에 미리 저장된 AI 매칭 사용 |
| 서브씬 처리 | 독립 랜덤 | 부모 씬 매칭 상속 |
| 주인공 보장 | 없음 | 매칭 없으면 첫 번째 캐릭터 자동 배정 |

---

## 단계 D: 통합 테스트

### 테스트 시나리오

| # | 테스트 | 확인 사항 |
|---|--------|----------|
| 1 | AI 분석 버튼 클릭 | LLM 호출 → 카드 추천 목록 표시 |
| 2 | 기존 카드 매칭 | cardLibrary에 있는 카드가 매칭됨 |
| 3 | 신규 카드 제안 | 매칭 안 되는 캐릭터 → 새 카드 생성 |
| 4 | 씬별 매칭 | 각 씬에 적절한 카드 자동 배정 |
| 5 | 쿼터 초과 | 6번째 분석 → Mock 자동 전환 |
| 6 | 에러 폴백 | API 에러 → 기본 카드로 폴백 |
| 7 | 빌드 | `npm run build` 에러 없음 |

### 콘솔 확인

```
[Quota] llm: 1/5 사용
[AI Analysis] 완료: { 추천카드: 5, 씬매칭: 10, provider: 'gemini', 소요시간: '3200ms' }
```

---

## 데이터 흐름 (최종)

```
IdeaPage: 대본 생성 (Gemini)
    ↓
    scenes: [{ id, text, location, cameraAngle }]
    ↓
StoryboardPage: "AI로 분석하기" 클릭
    ↓
analyzeScript(fullScript + scenes + cardLibrary)  ← LLM 1회 호출
    ↓
    ├── recommendedCards → 덱(selectedDeck) 자동 구성
    └── sceneMatching → sceneSeeds에 씬별 카드 매핑 저장
    ↓
CastSetupPhase: 추천 카드 표시 (수정 가능)
    ↓
SeedCheckPhase: initPrompts()
    ├── AI 매칭 결과 있으면 → 그대로 사용
    └── 없으면 → 키워드 매칭 폴백
    ↓
buildImagePrompt(seedCards) → 이미지 생성
buildVideoPrompt(seedCards) → 영상 생성
```

---

## 주의사항

1. **기존 수동 설정 보존**: 사용자가 이미 카드를 수동 배정한 씬은 AI가 덮어쓰지 않음
2. **에러 안전**: API 실패 시 기존 하드코딩 카드로 폴백 (UX 끊김 없음)
3. **쿼터 안전**: LLM 쿼터 1회만 소비, 초과 시 Mock 분석
4. **서브씬 호환**: `scene-N-0`, `scene-N-1` 키 구조 그대로 유지
5. **기존 UI 유지**: CastSetupPhase, SeedCheckPhase의 UI/UX 변경 최소화
