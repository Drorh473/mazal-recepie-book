# Mazal's Recipe Book — Design Spec
**Date:** 2026-04-10

---

## Overview

A web app to digitize a handwritten family recipe book. Users upload photos of recipe cards or record voice narrations; Claude AI (claude-sonnet-4-6) extracts and structures the recipe in Hebrew, assigns it to a category, and auto-commits it to the GitHub repo. The public-facing site displays the complete recipe book organized by category.

---

## Stack

- **Framework:** Next.js 15 App Router
- **Deployment:** Vercel free tier
- **Storage:** Recipe JSON files + audio recordings committed directly to the GitHub repo
- **AI:** Anthropic Claude claude-sonnet-4-6 via API (server-side only)
- **Language:** Hebrew (RTL throughout)

---

## Pages

### `/` — Recipe Book (public)
- Hero banner: "ספר המתכונים של מזל"
- Category tab bar (sticky): הכל + all 10 categories
- Recipes displayed as cards grouped by category
- Clicking a card expands to full recipe detail inline: ingredients list + instructions
- If a recording is attached, an audio player appears below the recipe
- No food photos — text only

### `/upload` — Add Recipe (open, no auth)
- Drag-and-drop / file picker for 1–20 images of recipe card pages (JPG, PNG, HEIC)
- Folder upload via `<input webkitdirectory>`
- Voice recorder using browser MediaRecorder API
- "Process with Claude" button → calls `/api/process`
- Result preview: editable title, category dropdown, ingredients, instructions
- "Save to Recipe Book" button → calls `/api/save`
- Error states: API rate limit, token exhaustion, file too large

---

## API Routes

### `POST /api/process`
**Input:** `multipart/form-data` with `images[]` (files) or `audio` (blob)

**Image flow:**
- Send each image to Claude claude-sonnet-4-6 with vision
- Prompt instructs Claude to extract recipe in Hebrew: title, category (from fixed list), ingredients array, instructions string
- Multiple images = one recipe spread across pages, merged into single result
- Returns: `{ title, category, ingredients: string[], instructions: string }`

**Audio flow:**
- Send audio blob to Claude with transcription + structuring prompt
- Same output shape as image flow

**Error handling:**
- `429` from Anthropic → return `{ error: "rate_limit", retryAfter: <seconds> }` — UI shows countdown
- Other API errors → return `{ error: "api_error", message }` — UI shows message in Hebrew

### `POST /api/save`
**Input:** `{ recipe: RecipeObject, audio?: base64string }`

**Flow:**
1. Generate slug from title (Hebrew slugified or UUID fallback)
2. Write recipe JSON to `data/recipes/<slug>.json`
3. If audio present, write to `public/recordings/<slug>.webm`
4. Commit both files to GitHub via GitHub Contents API using `GITHUB_TOKEN` env var
5. Returns: `{ success: true, slug }`

---

## Data Model

```ts
// data/recipes/<slug>.json
interface Recipe {
  id: string           // slug
  title: string        // Hebrew
  category: Category
  ingredients: string[]
  instructions: string
  audioPath?: string   // "/recordings/<slug>.webm" if present
  createdAt: string    // ISO date
}

type Category =
  | "סלטים" | "דגים" | "בשר" | "פשטידות"
  | "עוגות" | "עוגיות" | "חגים" | "מרקים"
  | "מאפים" | "ריבות ומטבלים"
```

---

## Environment Variables (Vercel)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API access |
| `GITHUB_TOKEN` | Repo write access for auto-commit |
| `GITHUB_REPO` | e.g. `dror/mazal-recpie-page` |
| `GITHUB_BRANCH` | e.g. `main` |

---

## Categories (fixed list passed to Claude in prompt)

סלטים · דגים · בשר · פשטידות · עוגות · עוגיות · חגים · מרקים · מאפים · ריבות ומטבלים

---

## UI Design

- **Palette:** Warm off-white bg `#f5f0eb`, dark brown `#3d2c1e`, terracotta accent `#c9703a`
- **Direction:** RTL everywhere
- **Responsive:** Mobile-first, single column on small screens
- **Font:** System UI stack (no external font load)
- Tailwind CSS for styling

---

## Error UX

- Rate limit: banner showing "Claude אינו זמין כרגע. ניתן לנסות שוב בעוד X דקות"
- Token exhaustion: same banner with support link
- File too large (>10MB/image): client-side rejection before upload
- Network error: generic retry button

---

## Verification

1. Run `npm run dev` → visit `localhost:3000`, verify recipe book renders (empty state)
2. Visit `/upload`, upload a photo of a handwritten recipe → verify Claude extracts Hebrew text
3. Click "Save" → verify JSON file appears in `data/recipes/` via GitHub commit
4. Return to `/` → verify new recipe appears in the correct category
5. Upload a folder of 3 images → verify they're merged into one recipe
6. Record voice → verify transcription and save flow
7. Simulate API error (bad key) → verify Hebrew error message shown
8. Test on mobile viewport → verify RTL layout and all inputs work
