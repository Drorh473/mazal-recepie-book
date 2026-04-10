# Mazal's Recipe Book — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 16 web app where the user uploads photos of handwritten recipe cards or records voice narrations; Claude AI extracts Hebrew recipes and auto-commits them to GitHub; a public recipe book page displays all recipes organized by category.

**Architecture:** Next.js 16 App Router on Vercel free tier. Two pages: `/` (public recipe book, server component with `use cache` + `cacheTag`) and `/upload` (client-side upload flow). Two API routes: `/api/process` calls Claude claude-sonnet-4-6 and `/api/save` commits recipe JSON + audio to GitHub via Contents API and calls `revalidateTag('recipes')`. Recipes stored as JSON in `data/recipes/`, audio in `public/recordings/`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS 3, @anthropic-ai/sdk, GitHub Contents API (native fetch), MediaRecorder API + Web Speech API (browser-native)

---

## File Map

| File | Purpose |
|---|---|
| `lib/types.ts` | Shared TypeScript types + CATEGORIES constant |
| `lib/recipes.ts` | Read recipe JSON files from `data/recipes/` at build/ISR time |
| `lib/claude.ts` | Anthropic client + prompt building + image/text processing |
| `lib/github.ts` | GitHub Contents API: commit files, generate slugs |
| `app/layout.tsx` | Root layout — RTL, Hebrew lang, global styles |
| `app/page.tsx` | Recipe book server component — reads recipes, passes to RecipeBook |
| `app/upload/page.tsx` | Upload page — full client-side flow |
| `app/api/process/route.ts` | POST: receives images or transcription → Claude → structured recipe |
| `app/api/save/route.ts` | POST: receives recipe + audio → GitHub commit → revalidatePath |
| `components/RecipeBook.tsx` | Category tabs + grouped recipe display (client) |
| `components/RecipeCard.tsx` | Single recipe card with expand/collapse (client) |
| `components/AudioPlayer.tsx` | Styled HTML5 audio player (client) |
| `components/UploadZone.tsx` | Drag-drop + file/folder picker (client) |
| `components/VoiceRecorder.tsx` | MediaRecorder + Web Speech API recorder (client) |
| `components/RecipeResult.tsx` | Editable recipe preview after AI processing (client) |
| `data/recipes/.gitkeep` | Placeholder so directory is committed |
| `public/recordings/.gitkeep` | Placeholder so directory is committed |

---

## Task 1: Bootstrap Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Initialize Next.js app**

```bash
cd /c/Users/dror/study/projects/mazal-recpie-page
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --yes
```

Expected: Next.js project created in current directory.

- [ ] **Step 2: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 3: Create data directories with placeholders**

```bash
mkdir -p data/recipes public/recordings
touch data/recipes/.gitkeep public/recordings/.gitkeep
```

- [ ] **Step 4: Update `next.config.ts` to enable Cache Components**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

- [ ] **Step 4b: Replace `app/layout.tsx` with RTL Hebrew layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ספר המתכונים של מזל',
  description: 'אוסף מתכונים משפחתי',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-[#f5f0eb] text-[#1a1a1a] min-h-screen">
        <nav className="bg-white border-b border-[#e5ddd5] px-6 py-3 flex items-center justify-between">
          <span className="font-semibold text-[#3d2c1e]">
            ספר המתכונים של <span className="text-[#c9703a]">מזל</span>
          </span>
          <div className="flex gap-6 text-sm text-[#7a6555]">
            <a href="/" className="hover:text-[#3d2c1e]">הספר</a>
            <a href="/upload" className="hover:text-[#3d2c1e]">הוספת מתכון</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Replace `app/globals.css`**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Create placeholder home page**

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <div className="text-center py-20 text-[#9e8474]">
      טוען מתכונים...
    </div>
  )
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Server at http://localhost:3000 shows nav bar and loading text.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js 15 with RTL Hebrew layout"
```

---

## Task 2: Types and Recipe Reading Lib

**Files:**
- Create: `lib/types.ts`
- Create: `lib/recipes.ts`
- Create: `lib/types.test.ts`
- Create: `lib/recipes.test.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```ts
// lib/types.ts
export const CATEGORIES = [
  'סלטים', 'דגים', 'בשר', 'פשטידות',
  'עוגות', 'עוגיות', 'חגים', 'מרקים',
  'מאפים', 'ריבות ומטבלים',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface Recipe {
  id: string
  title: string
  category: Category
  ingredients: string[]
  instructions: string
  audioPath?: string
  createdAt: string
}

export interface ProcessedRecipe {
  title: string
  category: Category
  ingredients: string[]
  instructions: string
}

export interface ApiError {
  error: 'rate_limit' | 'api_error' | 'invalid_input' | 'save_error'
  message: string
  retryAfter?: number
}
```

- [ ] **Step 2: Create `lib/recipes.ts`**

```ts
// lib/recipes.ts
import fs from 'fs'
import path from 'path'
import { cacheLife, cacheTag } from 'next/cache'
import { Recipe } from './types'

const RECIPES_DIR = path.join(process.cwd(), 'data', 'recipes')

export async function getAllRecipes(): Promise<Recipe[]> {
  'use cache'
  cacheTag('recipes')
  cacheLife('minutes')

  if (!fs.existsSync(RECIPES_DIR)) return []

  const files = fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith('.json'))

  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf-8')
      return JSON.parse(content) as Recipe
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}
```

- [ ] **Step 3: Install Jest + ts-jest for testing**

```bash
npm install --save-dev jest ts-jest @types/jest
```

Add to `package.json` scripts:
```json
"test": "jest"
```

Add `jest.config.ts`:
```ts
// jest.config.ts
import type { Config } from 'jest'
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}
export default config
```

- [ ] **Step 4: Write test for `getAllRecipes`**

```ts
// lib/recipes.test.ts
import fs from 'fs'
import path from 'path'
import { getAllRecipes } from './recipes'

const RECIPES_DIR = path.join(process.cwd(), 'data', 'recipes')

describe('getAllRecipes', () => {
  const testFile = path.join(RECIPES_DIR, '_test-recipe.json')

  beforeEach(() => {
    const recipe = {
      id: 'test-1',
      title: 'עוגת בדיקה',
      category: 'עוגות',
      ingredients: ['קמח', 'ביצים'],
      instructions: 'מערבבים הכל',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    fs.writeFileSync(testFile, JSON.stringify(recipe))
  })

  afterEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
  })

  it('returns parsed recipe objects', () => {
    const recipes = getAllRecipes()
    const found = recipes.find((r) => r.id === 'test-1')
    expect(found).toBeDefined()
    expect(found?.title).toBe('עוגת בדיקה')
    expect(found?.ingredients).toEqual(['קמח', 'ביצים'])
  })

  it('returns newest first', () => {
    const older = path.join(RECIPES_DIR, '_test-older.json')
    fs.writeFileSync(
      older,
      JSON.stringify({ id: 'old', title: 'ישן', category: 'סלטים', ingredients: [], instructions: '', createdAt: '2025-01-01T00:00:00.000Z' })
    )
    const recipes = getAllRecipes()
    const ids = recipes.map((r) => r.id)
    expect(ids.indexOf('test-1')).toBeLessThan(ids.indexOf('old'))
    fs.unlinkSync(older)
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test -- lib/recipes.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/ jest.config.ts package.json
git commit -m "feat: add Recipe types and getAllRecipes with tests"
```

---

## Task 3: Claude Processing Lib

**Files:**
- Create: `lib/claude.ts`
- Create: `lib/claude.test.ts`

- [ ] **Step 1: Create `lib/claude.ts`**

```ts
// lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import { CATEGORIES, ProcessedRecipe } from './types'

const client = new Anthropic()

const SYSTEM_PROMPT = `אתה מחלץ מתכון מכרטיס מתכון כתוב ביד או מודפס בעברית.
ענה אך ורק עם JSON תקני בפורמט הבא, ללא טקסט נוסף:
{
  "title": "שם המתכון בעברית",
  "category": "אחת בדיוק מהרשימה: ${CATEGORIES.join(' | ')}",
  "ingredients": ["מצרך 1", "מצרך 2"],
  "instructions": "הוראות הכנה מלאות בעברית"
}
חשוב: הקטגוריה חייבת להיות אחת מהרשימה המצוינת בלבד.`

export function buildImageMessages(
  imageBase64List: string[],
  mimeTypes: string[]
): Anthropic.MessageParam[] {
  const imageContent: Anthropic.ImageBlockParam[] = imageBase64List.map(
    (data, i) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: (mimeTypes[i] || 'image/jpeg') as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'image/gif',
        data,
      },
    })
  )
  return [
    {
      role: 'user',
      content: [
        ...imageContent,
        { type: 'text', text: 'חלץ את המתכון מהתמונות.' },
      ],
    },
  ]
}

export function buildTranscriptionMessages(
  transcription: string
): Anthropic.MessageParam[] {
  return [
    {
      role: 'user',
      content: `הנה תמלול של מתכון שהוקלט בקול. ארגן אותו כמתכון:\n\n${transcription}`,
    },
  ]
}

export async function processImages(
  imageBase64List: string[],
  mimeTypes: string[]
): Promise<ProcessedRecipe> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: buildImageMessages(imageBase64List, mimeTypes),
  })
  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ProcessedRecipe
}

export async function processTranscription(
  transcription: string
): Promise<ProcessedRecipe> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: buildTranscriptionMessages(transcription),
  })
  const text =
    response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ProcessedRecipe
}
```

- [ ] **Step 2: Write tests for prompt builders (no API call)**

```ts
// lib/claude.test.ts
import { buildImageMessages, buildTranscriptionMessages } from './claude'

describe('buildImageMessages', () => {
  it('includes all images and a text prompt', () => {
    const messages = buildImageMessages(['abc123', 'def456'], ['image/jpeg', 'image/png'])
    const content = messages[0].content as any[]
    expect(content).toHaveLength(3) // 2 images + 1 text
    expect(content[0].type).toBe('image')
    expect(content[0].source.data).toBe('abc123')
    expect(content[1].source.media_type).toBe('image/png')
    expect(content[2].type).toBe('text')
  })

  it('defaults mime type to image/jpeg when missing', () => {
    const messages = buildImageMessages(['data'], [''])
    const content = messages[0].content as any[]
    expect(content[0].source.media_type).toBe('image/jpeg')
  })
})

describe('buildTranscriptionMessages', () => {
  it('wraps transcription in a user message', () => {
    const messages = buildTranscriptionMessages('קמח וביצים')
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('קמח וביצים')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/claude.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/claude.ts lib/claude.test.ts
git commit -m "feat: add Claude processing lib with prompt builders"
```

---

## Task 4: GitHub Commit Lib

**Files:**
- Create: `lib/github.ts`
- Create: `lib/github.test.ts`

- [ ] **Step 1: Create `lib/github.ts`**

```ts
// lib/github.ts

export function generateSlug(title: string): string {
  const timestamp = Date.now()
  // Keep Hebrew and alphanumeric, replace rest with dashes
  const sanitized = title
    .replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${sanitized}-${timestamp}`
}

async function getFileSha(
  filePath: string,
  repo: string,
  token: string,
  branch: string
): Promise<string | undefined> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  )
  if (res.status === 404) return undefined
  if (!res.ok) return undefined
  const data = await res.json()
  return data.sha as string
}

export async function commitFile(params: {
  path: string
  content: string // base64-encoded
  message: string
  branch?: string
}): Promise<void> {
  const repo = process.env.GITHUB_REPO!
  const token = process.env.GITHUB_TOKEN!
  const branch = params.branch ?? process.env.GITHUB_BRANCH ?? 'main'

  const sha = await getFileSha(params.path, repo, token, branch)

  const body: Record<string, string> = {
    message: params.message,
    content: params.content,
    branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${params.path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`GitHub API error: ${err.message}`)
  }
}
```

- [ ] **Step 2: Write tests for `generateSlug`**

```ts
// lib/github.test.ts
import { generateSlug } from './github'

describe('generateSlug', () => {
  it('includes timestamp suffix', () => {
    const before = Date.now()
    const slug = generateSlug('עוגת שיש')
    const after = Date.now()
    const parts = slug.split('-')
    const ts = parseInt(parts[parts.length - 1])
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('retains Hebrew characters', () => {
    const slug = generateSlug('עוגת שוקולד')
    expect(slug).toMatch(/עוגת/)
  })

  it('replaces spaces and special chars with dashes', () => {
    const slug = generateSlug('fish & chips!')
    expect(slug).not.toContain(' ')
    expect(slug).not.toContain('&')
    expect(slug).not.toContain('!')
  })

  it('truncates long titles to ≤40 chars before timestamp', () => {
    const slug = generateSlug('א'.repeat(100))
    const withoutTimestamp = slug.split('-').slice(0, -1).join('-')
    expect(withoutTimestamp.length).toBeLessThanOrEqual(40)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/github.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/github.ts lib/github.test.ts
git commit -m "feat: add GitHub commit lib with generateSlug"
```

---

## Task 5: API Route — /api/process

**Files:**
- Create: `app/api/process/route.ts`

- [ ] **Step 1: Create `app/api/process/route.ts`**

```ts
// app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { processImages, processTranscription } from '@/lib/claude'
import { ApiError } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const transcription = formData.get('transcription') as string | null

    if (transcription) {
      const recipe = await processTranscription(transcription)
      return NextResponse.json(recipe)
    }

    const images = formData.getAll('images') as File[]
    if (!images.length) {
      const err: ApiError = { error: 'invalid_input', message: 'לא נשלחו תמונות' }
      return NextResponse.json(err, { status: 400 })
    }

    if (images.length > 20) {
      const err: ApiError = { error: 'invalid_input', message: 'ניתן להעלות עד 20 תמונות בפעם אחת' }
      return NextResponse.json(err, { status: 400 })
    }

    const imageBase64List = await Promise.all(
      images.map(async (img) => {
        const buffer = await img.arrayBuffer()
        return Buffer.from(buffer).toString('base64')
      })
    )
    const mimeTypes = images.map((img) => img.type || 'image/jpeg')

    const recipe = await processImages(imageBase64List, mimeTypes)
    return NextResponse.json(recipe)
  } catch (err: any) {
    // Anthropic rate limit
    if (err?.status === 429) {
      const retryAfter = err?.headers?.['retry-after']
        ? parseInt(err.headers['retry-after'])
        : 60
      const apiErr: ApiError = {
        error: 'rate_limit',
        message: 'הגעת למגבלת הבקשות של Claude',
        retryAfter,
      }
      return NextResponse.json(apiErr, { status: 429 })
    }
    const apiErr: ApiError = {
      error: 'api_error',
      message: err?.message || 'שגיאה בעיבוד המתכון',
    }
    return NextResponse.json(apiErr, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: No TypeScript errors for `app/api/process/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/process/
git commit -m "feat: add /api/process route for Claude image/audio processing"
```

---

## Task 6: API Route — /api/save

**Files:**
- Create: `app/api/save/route.ts`

- [ ] **Step 1: Create `app/api/save/route.ts`**

```ts
// app/api/save/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { commitFile, generateSlug } from '@/lib/github'
import type { Recipe, ProcessedRecipe } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      recipe: ProcessedRecipe
      audio?: string // base64 webm
    }

    const slug = generateSlug(body.recipe.title)
    const now = new Date().toISOString()

    const fullRecipe: Recipe = {
      ...body.recipe,
      id: slug,
      createdAt: now,
      audioPath: body.audio ? `/recordings/${slug}.webm` : undefined,
    }

    // Commit recipe JSON
    await commitFile({
      path: `data/recipes/${slug}.json`,
      content: Buffer.from(JSON.stringify(fullRecipe, null, 2)).toString('base64'),
      message: `feat: add recipe "${body.recipe.title}"`,
    })

    // Commit audio recording if provided
    if (body.audio) {
      await commitFile({
        path: `public/recordings/${slug}.webm`,
        content: body.audio,
        message: `feat: add recording for "${body.recipe.title}"`,
      })
    }

    revalidateTag('recipes')

    return NextResponse.json({ success: true, id: slug })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'save_error', message: err?.message || 'שגיאה בשמירת המתכון' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/save/
git commit -m "feat: add /api/save route for GitHub auto-commit"
```

---

## Task 7: Recipe Book Page + RecipeBook + RecipeCard Components

**Files:**
- Modify: `app/page.tsx`
- Create: `components/RecipeBook.tsx`
- Create: `components/RecipeCard.tsx`
- Create: `components/AudioPlayer.tsx`

- [ ] **Step 1: Update `app/page.tsx`**

```tsx
// app/page.tsx
import { getAllRecipes } from '@/lib/recipes'
import RecipeBook from '@/components/RecipeBook'

export default async function HomePage() {
  const recipes = await getAllRecipes()
  return <RecipeBook recipes={recipes} />
}
```

- [ ] **Step 2: Create `components/AudioPlayer.tsx`**

```tsx
// components/AudioPlayer.tsx
'use client'
import { useRef, useState } from 'react'

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const onTimeUpdate = () => {
    if (!audioRef.current) return
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100
    setProgress(isNaN(pct) ? 0 : pct)
  }

  const onEnded = () => setPlaying(false)

  return (
    <div className="flex items-center gap-3 bg-[#f5f0eb] border-t border-[#e5ddd5] px-5 py-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-[#c9703a] text-white flex items-center justify-center text-xs shrink-0 hover:bg-[#b5622e] transition-colors"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <span className="text-xs text-[#7a6555] shrink-0">הקלטה קולית</span>
      <div className="flex-1 h-1 bg-[#e5ddd5] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#c9703a] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/RecipeCard.tsx`**

```tsx
// components/RecipeCard.tsx
'use client'
import AudioPlayer from './AudioPlayer'
import type { Recipe } from '@/lib/types'

interface Props {
  recipe: Recipe
  isExpanded: boolean
  onToggle: () => void
}

export default function RecipeCard({ recipe, isExpanded, onToggle }: Props) {
  return (
    <div
      className={`bg-white border border-[#e5ddd5] rounded-xl overflow-hidden transition-shadow ${
        isExpanded ? 'shadow-md' : 'hover:shadow-sm hover:border-[#d9cfc5]'
      }`}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-right px-4 py-4 flex items-start justify-between gap-2 group"
      >
        <div>
          <h3 className="font-semibold text-[#3d2c1e] text-sm leading-snug">
            {recipe.title}
          </h3>
          <span className="inline-block mt-1 text-[10px] font-semibold bg-[#fff0eb] text-[#c9703a] px-2 py-0.5 rounded-full">
            {recipe.category}
          </span>
        </div>
        <span className="text-[#9e8474] text-xs mt-1 shrink-0 group-hover:text-[#3d2c1e] transition-colors">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div>
          <div className="px-4 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-[#f0ebe6]">
            {/* Ingredients */}
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-2">
                מצרכים
              </p>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="text-sm text-[#3d2c1e] border-b border-[#f5f0eb] pb-1 last:border-0"
                  >
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            {/* Instructions */}
            <div className="pt-4">
              <p className="text-[10px] font-bold text-[#9e8474] uppercase tracking-widest mb-2">
                הכנה
              </p>
              <p className="text-sm text-[#3d2c1e] leading-relaxed whitespace-pre-line">
                {recipe.instructions}
              </p>
            </div>
          </div>
          {recipe.audioPath && <AudioPlayer src={recipe.audioPath} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/RecipeBook.tsx`**

```tsx
// components/RecipeBook.tsx
'use client'
import { useState } from 'react'
import RecipeCard from './RecipeCard'
import type { Recipe } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'

export default function RecipeBook({ recipes }: { recipes: Recipe[] }) {
  const [activeCategory, setActiveCategory] = useState<string>('הכל')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered =
    activeCategory === 'הכל'
      ? recipes
      : recipes.filter((r) => r.category === activeCategory)

  // Group by category in the defined order
  const grouped = CATEGORIES.reduce<Record<string, Recipe[]>>((acc, cat) => {
    const items = filtered.filter((r) => r.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <>
      {/* Hero */}
      <div className="bg-[#3d2c1e] text-white text-center py-12 px-6">
        <h1 className="text-3xl font-bold mb-1">
          ספר המתכונים של{' '}
          <span className="text-[#c9703a]">מזל</span>
        </h1>
        <p className="text-[#b5a59a] text-sm">{recipes.length} מתכונים</p>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b border-[#e5ddd5] overflow-x-auto">
        <div className="flex whitespace-nowrap px-4 min-w-max">
          {['הכל', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeCategory === cat
                  ? 'text-[#c9703a] border-[#c9703a]'
                  : 'text-[#7a6555] border-transparent hover:text-[#3d2c1e]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-20 text-[#9e8474]">
            <p className="text-lg mb-3">עדיין אין מתכונים בקטגוריה זו</p>
            <a href="/upload" className="text-[#c9703a] underline text-sm">
              הוסיפי מתכון ראשון
            </a>
          </div>
        )}

        {Object.entries(grouped).map(([cat, catRecipes]) => (
          <div key={cat} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-[#3d2c1e] shrink-0">
                {cat}
              </h2>
              <div className="flex-1 h-px bg-[#e5ddd5]" />
              <span className="text-xs text-[#9e8474] shrink-0">
                {catRecipes.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isExpanded={expandedId === recipe.id}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === recipe.id ? null : recipe.id
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 5: Run dev and verify recipe book renders**

```bash
npm run dev
```

Visit http://localhost:3000 — should see hero, tabs, and empty state with link to /upload.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/
git commit -m "feat: add recipe book page with category tabs and expandable cards"
```

---

## Task 8: UploadZone + VoiceRecorder Components

**Files:**
- Create: `components/UploadZone.tsx`
- Create: `components/VoiceRecorder.tsx`

- [ ] **Step 1: Create `components/UploadZone.tsx`**

```tsx
// components/UploadZone.tsx
'use client'
import { useRef, useState, DragEvent, ChangeEvent } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

export default function UploadZone({ onFiles, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(
        f.type.toLowerCase()
      )
    )
    if (valid.length) onFiles(valid.slice(0, 20))
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragging
            ? 'border-[#c9703a] bg-[#fff8f5]'
            : 'border-[#d9cfc5] bg-white hover:border-[#c9703a]'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-sm text-[#5c4a3a] mb-4 leading-relaxed">
          גרור לכאן תמונות של דפי מתכונים<br />
          או בחר קבצים מהמכשיר
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-sm rounded-lg border border-[#c9703a] text-[#c9703a] bg-white hover:bg-[#fff0eb] transition-colors font-medium"
          >
            בחר תמונה
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="px-4 py-2 text-sm rounded-lg border border-[#d9cfc5] text-[#3d2c1e] bg-white hover:bg-[#f5f0eb] transition-colors font-medium"
          >
            בחר תיקייה
          </button>
        </div>
        <p className="text-xs text-[#b5a59a] mt-3">
          JPG · PNG · HEIC · עד 20 תמונות
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />
        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error - webkitdirectory is non-standard
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/VoiceRecorder.tsx`**

```tsx
// components/VoiceRecorder.tsx
'use client'
import { useState, useRef } from 'react'

interface Props {
  onRecordingComplete: (audioBase64: string, transcription: string) => void
  disabled?: boolean
}

export default function VoiceRecorder({ onRecordingComplete, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [liveText, setLiveText] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)

  const startRecording = async () => {
    setLiveText('')
    chunksRef.current = []

    // Start MediaRecorder for audio capture
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorder.start(100)

    // Start Web Speech API for live transcription
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = 'he-IL'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setLiveText(transcript)
      }
      recognition.start()
      recognitionRef.current = recognition
    }

    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()

    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder) return

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const reader = new FileReader()
      reader.onload = () => {
        // result is "data:audio/webm;base64,<data>" — strip the prefix
        const base64 = (reader.result as string).split(',')[1]
        onRecordingComplete(base64, liveText)
      }
      reader.readAsDataURL(blob)

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach((t) => t.stop())
    }
    mediaRecorder.stop()
    setRecording(false)
  }

  return (
    <div className={`bg-white border border-[#e5ddd5] rounded-xl p-5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="text-3xl">🎙️</div>
        <div className="flex-1">
          <p className="font-semibold text-[#3d2c1e] text-sm">הקלטת מתכון בקול</p>
          <p className="text-xs text-[#9e8474]">ספרי את המתכון — Claude יארגן אותו אוטומטית</p>
        </div>
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 text-sm rounded-lg bg-[#fff0eb] text-[#c9703a] border border-[#f0cdb8] hover:bg-[#ffe4d4] transition-colors font-semibold shrink-0"
          >
            ● הקלטה
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="px-4 py-2 text-sm rounded-lg bg-[#c9703a] text-white border border-[#c9703a] hover:bg-[#b5622e] transition-colors font-semibold shrink-0 animate-pulse"
          >
            ■ עצור
          </button>
        )}
      </div>
      {liveText && (
        <div className="mt-3 p-3 bg-[#f5f0eb] rounded-lg text-sm text-[#3d2c1e] leading-relaxed max-h-28 overflow-y-auto">
          {liveText}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/UploadZone.tsx components/VoiceRecorder.tsx
git commit -m "feat: add UploadZone drag-drop and VoiceRecorder components"
```

---

## Task 9: RecipeResult Component + Upload Page

**Files:**
- Create: `components/RecipeResult.tsx`
- Create: `app/upload/page.tsx`

- [ ] **Step 1: Create `components/RecipeResult.tsx`**

```tsx
// components/RecipeResult.tsx
'use client'
import { useState } from 'react'
import type { ProcessedRecipe } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'

interface Props {
  recipe: ProcessedRecipe
  onChange: (recipe: ProcessedRecipe) => void
}

export default function RecipeResult({ recipe, onChange }: Props) {
  const [ingredientsText, setIngredientsText] = useState(
    recipe.ingredients.join('\n')
  )

  const handleIngredientsChange = (val: string) => {
    setIngredientsText(val)
    onChange({
      ...recipe,
      ingredients: val.split('\n').filter((l) => l.trim()),
    })
  }

  return (
    <div className="bg-white border border-[#d5e8d0] rounded-xl overflow-hidden">
      <div className="bg-[#f0f7ee] px-4 py-2.5 flex items-center gap-2 text-sm text-[#4a7c40] font-medium border-b border-[#d5e8d0]">
        <span>✓</span>
        <span>המתכון זוהה — ניתן לערוך לפני שמירה</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            שם המתכון
          </label>
          <input
            value={recipe.title}
            onChange={(e) => onChange({ ...recipe, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a]"
          />
        </div>
        {/* Category */}
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            קטגוריה
          </label>
          <select
            value={recipe.category}
            onChange={(e) =>
              onChange({ ...recipe, category: e.target.value as any })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        {/* Ingredients */}
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            מצרכים (שורה אחת לכל מצרך)
          </label>
          <textarea
            value={ingredientsText}
            onChange={(e) => handleIngredientsChange(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] resize-y"
          />
        </div>
        {/* Instructions */}
        <div>
          <label className="text-xs font-bold text-[#9e8474] uppercase tracking-wider block mb-1">
            הוראות הכנה
          </label>
          <textarea
            value={recipe.instructions}
            onChange={(e) =>
              onChange({ ...recipe, instructions: e.target.value })
            }
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-[#e5ddd5] text-[#3d2c1e] text-sm focus:outline-none focus:border-[#c9703a] resize-y"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/upload/page.tsx`**

```tsx
// app/upload/page.tsx
'use client'
import { useState, useRef } from 'react'
import UploadZone from '@/components/UploadZone'
import VoiceRecorder from '@/components/VoiceRecorder'
import RecipeResult from '@/components/RecipeResult'
import type { ProcessedRecipe, ApiError } from '@/lib/types'

type Stage = 'idle' | 'processing' | 'result' | 'saving' | 'saved' | 'error'

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [recipe, setRecipe] = useState<ProcessedRecipe | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const audioBase64Ref = useRef<string | null>(null)
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRetryCountdown = (seconds: number) => {
    setRetrySeconds(seconds)
    retryIntervalRef.current = setInterval(() => {
      setRetrySeconds((s) => {
        if (s <= 1) {
          clearInterval(retryIntervalRef.current!)
          setStage('idle')
          setError(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const processFiles = async (files: File[]) => {
    setStage('processing')
    setError(null)
    audioBase64Ref.current = null

    const formData = new FormData()
    files.forEach((f) => formData.append('images', f))

    const res = await fetch('/api/process', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      const err = data as ApiError
      setError(err)
      setStage('error')
      if (err.error === 'rate_limit' && err.retryAfter) {
        startRetryCountdown(err.retryAfter)
      }
      return
    }

    setRecipe(data as ProcessedRecipe)
    setStage('result')
  }

  const processVoice = async (audioBase64: string, transcription: string) => {
    setStage('processing')
    setError(null)
    audioBase64Ref.current = audioBase64

    const formData = new FormData()
    formData.append('transcription', transcription)

    const res = await fetch('/api/process', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      const err = data as ApiError
      setError(err)
      setStage('error')
      if (err.error === 'rate_limit' && err.retryAfter) {
        startRetryCountdown(err.retryAfter)
      }
      return
    }

    setRecipe(data as ProcessedRecipe)
    setStage('result')
  }

  const save = async () => {
    if (!recipe) return
    setStage('saving')

    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe, audio: audioBase64Ref.current }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data as ApiError)
      setStage('error')
      return
    }

    setStage('saved')
  }

  const reset = () => {
    setStage('idle')
    setRecipe(null)
    setError(null)
    audioBase64Ref.current = null
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#3d2c1e] mb-1">הוספת מתכון חדש</h1>
      <p className="text-sm text-[#9e8474] mb-8">
        העלי תמונה של דף המתכון הכתוב, תיקייה של תמונות, או הקליטי בקול
      </p>

      {/* Success state */}
      {stage === 'saved' && (
        <div className="bg-[#f0f7ee] border border-[#d5e8d0] rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✓</div>
          <p className="font-semibold text-[#3d2c1e] mb-1">המתכון נשמר!</p>
          <p className="text-sm text-[#7a6555] mb-4">
            הוא יופיע בספר תוך כ-2 דקות לאחר פרסום אוטומטי
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="px-4 py-2 text-sm rounded-lg bg-[#3d2c1e] text-white hover:bg-[#2d1e10] transition-colors"
            >
              לספר המתכונים
            </a>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm rounded-lg border border-[#d9cfc5] text-[#3d2c1e] hover:bg-[#f5f0eb] transition-colors"
            >
              הוסיפי עוד מתכון
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {stage === 'error' && error && (
        <div className="bg-[#fff8f5] border border-[#f0cdb8] rounded-xl p-4 mb-6 text-sm text-[#8b3a1a]">
          <p className="font-semibold mb-1">
            {error.error === 'rate_limit' ? '⏳ Claude אינו זמין כרגע' : '⚠️ שגיאה'}
          </p>
          <p>{error.message}</p>
          {error.error === 'rate_limit' && retrySeconds > 0 && (
            <p className="mt-1 text-xs">ניתן לנסות שוב בעוד {retrySeconds} שניות</p>
          )}
          {error.error !== 'rate_limit' && (
            <button
              onClick={reset}
              className="mt-2 text-xs underline"
            >
              נסי שוב
            </button>
          )}
        </div>
      )}

      {/* Upload/record inputs */}
      {(stage === 'idle' || stage === 'error') && error?.error !== 'rate_limit' && (
        <>
          <UploadZone onFiles={processFiles} disabled={stage === 'processing'} />
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#e5ddd5]" />
            <span className="text-xs text-[#b5a59a]">או</span>
            <div className="flex-1 h-px bg-[#e5ddd5]" />
          </div>
          <VoiceRecorder
            onRecordingComplete={processVoice}
            disabled={stage === 'processing'}
          />
        </>
      )}

      {/* Processing spinner */}
      {stage === 'processing' && (
        <div className="text-center py-16 text-[#9e8474]">
          <div className="text-4xl mb-4 animate-spin inline-block">⚙️</div>
          <p className="text-sm">Claude מעבד את המתכון...</p>
        </div>
      )}

      {/* Recipe result + save */}
      {stage === 'result' && recipe && (
        <div className="space-y-4">
          <RecipeResult recipe={recipe} onChange={setRecipe} />
          <div className="flex gap-3">
            <button
              onClick={save}
              className="flex-1 py-3 rounded-xl bg-[#3d2c1e] text-white font-semibold text-sm hover:bg-[#2d1e10] transition-colors"
            >
              💾 שמור לספר המתכונים
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 rounded-xl border border-[#d9cfc5] text-[#3d2c1e] text-sm hover:bg-[#f5f0eb] transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Saving spinner */}
      {stage === 'saving' && (
        <div className="text-center py-16 text-[#9e8474]">
          <p className="text-sm">שומר לספר המתכונים...</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run dev and test upload page**

```bash
npm run dev
```

Visit http://localhost:3000/upload — should see upload zone, divider, voice recorder. Verify no console errors.

- [ ] **Step 4: Commit**

```bash
git add components/RecipeResult.tsx app/upload/
git commit -m "feat: add upload page with full process/save flow and error handling"
```

---

## Task 10: Environment Setup + Deployment

**Files:**
- Create: `.env.local` (local only, not committed)
- Create: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.local.example`**

```bash
# .env.local.example
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=github_pat_...
GITHUB_REPO=your-username/mazal-recpie-page
GITHUB_BRANCH=main
```

- [ ] **Step 2: Create your local `.env.local`**

Create `.env.local` in the project root with your actual values:
```
ANTHROPIC_API_KEY=<your Anthropic API key from console.anthropic.com>
GITHUB_TOKEN=<GitHub PAT with repo scope from github.com/settings/tokens>
GITHUB_REPO=<your-github-username>/mazal-recpie-page
GITHUB_BRANCH=main
```

- [ ] **Step 3: Verify `.env.local` is in `.gitignore`**

Open `.gitignore` and confirm `.env.local` is listed. If not, add it:
```
.env.local
```

- [ ] **Step 4: Test full flow locally**

1. Start dev server: `npm run dev`
2. Visit http://localhost:3000/upload
3. Upload a photo of any text document
4. Verify Claude returns a structured recipe
5. Click "Save" — verify it calls `/api/save`
6. In dev, the save will fail (no GitHub env vars) — that's expected
7. Set actual env vars in `.env.local` and retry

- [ ] **Step 5: Build for production check**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 6: Commit remaining files**

```bash
git add .env.local.example .gitignore next.config.ts
git commit -m "chore: add env example and verify production build"
```

- [ ] **Step 7: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 8: Set Vercel environment variables**

In the Vercel dashboard for this project, go to Settings → Environment Variables and add:
- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_BRANCH`

- [ ] **Step 9: Trigger Vercel deployment**

Vercel auto-deploys on push. Visit the deployment URL from the Vercel dashboard and test the full flow end-to-end.

---

## Verification Checklist

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript or build errors
- [ ] Visit `/` — hero, tabs, empty state with link
- [ ] Visit `/upload` — drag-drop zone, voice recorder visible
- [ ] Upload a photo → Claude returns structured Hebrew recipe
- [ ] Edit recipe fields → changes persist
- [ ] Save → recipe appears in `data/recipes/` as JSON in GitHub
- [ ] Return to `/` within 2 minutes → new recipe visible in correct category
- [ ] Upload folder of 3 images → merged into one recipe
- [ ] Record voice → transcription appears live → Claude structures it
- [ ] Save with audio → `public/recordings/` file committed to GitHub
- [ ] Recipe with audio → audio player appears and plays
- [ ] Simulate bad API key → Hebrew error message shown
- [ ] Mobile viewport (375px) → RTL layout intact, inputs usable
