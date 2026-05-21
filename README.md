# Clinexio — Draft Quality Tester

A single-page web app that lets non-engineers (clinicians, clients)
test how the Clinexio AI would respond to a patient question, with two
clinics shown side-by-side — one with a populated knowledge base (Secret
Aesthetics) and one with only platform-tier default knowledge (a
brand-new Demo Clinic).

The page calls the existing Clinexio API at
`/api/v1/test/draft-pair` via a thin server-side proxy so the API's
bearer secret never reaches the browser.

## Run locally

```bash
npm install
cp .env.local.example .env.local
# edit .env.local with the real values
npm run dev
```

Open <http://localhost:3000>.

## Required env vars

| Variable                   | Where it's read    | What it holds                                              |
| -------------------------- | ------------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | server + browser   | Base URL of the deployed Clinexio API (no trailing slash). |
| `DEMO_DRAFT_PAIR_SECRET`   | **server only**    | Bearer token used to authenticate to the backend.          |

`DEMO_DRAFT_PAIR_SECRET` must match the env var with the same name on
the backend (set in the AWS task definition / Vercel-equivalent).

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the GitHub repo. Vercel
   auto-detects Next.js.
3. **Environment Variables**: add both env vars above. Make sure
   `DEMO_DRAFT_PAIR_SECRET` is marked as "encrypted, server-only"
   (Vercel's default for non-`NEXT_PUBLIC_` vars).
4. Click **Deploy**.
5. After deploy, hit `https://<your-project>.vercel.app/api/draft-pair`
   with a GET → returns `{ "ok": true, "configured": true, ... }` to
   confirm env vars are wired.

## What the page does

- **Single form** with: patient question (textarea) + optional patient
  first name (defaults to "Sarah" in the AI's greeting).
- On submit → calls the local `/api/draft-pair` proxy → forwards to the
  AWS API → returns both clinics' drafts.
- **Two panels** render side-by-side: one for Secret Aesthetics, one
  for the Demo Clinic. Each panel shows:
  - Category chip ("New enquiry", "Urgent escalation", etc.)
  - The drafted email body
  - A collapsible "Show what the AI used" panel listing the references
    (KB chunks) that informed the draft.
- A **"Show technical details"** toggle (footer) reveals raw
  classification fields and chunk excerpts for debugging.

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Server-side route handler (`app/api/draft-pair/route.ts`) hides the
  bearer secret + handles upstream timeouts gracefully.

## Repository hygiene

- `.env.local` is gitignored — never commit real secrets.
- `node_modules/` and `.next/` are gitignored.
- This repo is intentionally **separate** from the main `clinexio-api`
  repo so Vercel can deploy independently.

## Error handling shape (for the curious)

Friendly UI messages are mapped from upstream status codes in
[`lib/translate.ts`](./lib/translate.ts):

| Backend / proxy returns                              | UI shows                                                |
| ---------------------------------------------------- | ------------------------------------------------------- |
| 503 / network unreachable                            | "The drafts service isn't ready yet — try again..."     |
| 401                                                  | "Configuration issue — please contact your admin"      |
| 429                                                  | "Too many tests in a row — give it 60 seconds..."       |
| 504 / proxy timeout                                  | "The AI took too long — please try again"               |
| Pipeline `draft.status='model_unavailable'`          | "The AI was slow this time. Click Generate to retry."   |
| Pipeline `draft.status='guardrail_failed'`           | "AI safety check blocked this — flagged for review"     |
