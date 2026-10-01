# Notion AI Clone

A self-hosted, Notion-style workspace with a built-in AI writing assistant and
AI Q&A over your own notes — your own copy of "Notion AI".

## Features

**Inline AI, the way Notion does it**
- Press **space** on an empty line, type `/ai`, or press **Ctrl/⌘+J** to open the AI panel right under your cursor.
- Select text and click **✨ Ask AI** in the toolbar to improve writing, fix spelling and grammar, make it shorter or longer, simplify, change tone, translate, explain or summarize.
- Answers stream in formatted. Then choose **Replace selection**, **Insert below**, **Continue writing**, **Make longer**, **Try again** or **Discard**, or type a follow-up instruction.
- **Ask AI about your workspace**: a chat panel that answers from your own pages, with links to the pages it used.

**Editor and pages**
- Block editor with headings, lists, to-dos, tables, code, images and more, plus slash commands and block drag handles ([BlockNote](https://www.blocknotejs.org/)).
- Cover images (color and gradient presets, or any image link), emoji page icons, and titles that wrap.
- A top bar with breadcrumbs, save status, Share, Favorites and a page menu.
- Autosave that detects when someone else saved the page while you had it open, instead of silently overwriting their work.

**Sidebar**
- Nested pages you can drag to reorder or drop onto another page to nest them.
- A **⋯** menu on each page: Favorite, Copy link, Duplicate (with sub-pages), Rename, Move to Trash.
- Favorites, **Trash** (restore or delete permanently), and **Search** (Ctrl/⌘+K) across titles and page text.
- A workspace switcher, and a collapsible sidebar (Ctrl/⌘+\\) that slides in from the side on phones.

**Teamwork**
- Invite colleagues with a workspace invite link. The owner can reset the link or remove members.
- **Share to web**: publish any page as a read-only public link.
- Page comments.

**My tracker** (private to each person)
- **Week**: a board with a column per day plus "No date". Add the work you were given this week, drag cards between days, tick them off, and open any card to set status, priority, a delivery date and time, a reminder and notes.
- **Time**: a start/stop timer (linked to a task or not), manual entries, and per-day and per-week totals.
- **Calendar**: a month view of your deliveries and the hours you logged each day.
- **Reminders**:
  - A bell in the sidebar with a count of what's overdue or due within a day.
  - A pop-up card and a desktop notification when a reminder time arrives, while the app is open in a tab.
  - A private calendar link you add once to Google Calendar or Outlook.

**Under the hood**
- Email/password accounts. Each user gets their own workspace and can create more.
- Swappable AI providers: text generation with OpenAI or Anthropic, embeddings with OpenAI or Voyage AI, chosen by environment variable with no code changes.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM (7.x, with the `prisma-client` generator and `@prisma/adapter-pg` driver adapter)
- NextAuth (Credentials provider, JWT sessions)
- BlockNote for the rich text editor
- OpenAI / Anthropic SDKs behind a small provider abstraction (`src/lib/ai`)

## Getting started

### 1. Start Postgres

```bash
docker compose up -d
```

This starts a local Postgres on `localhost:5432` matching the default `DATABASE_URL` below. (If you already have Postgres running locally, just point `DATABASE_URL` at it instead.)

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in at least one AI provider key:

- `OPENAI_API_KEY` — used for text generation (if `AI_TEXT_PROVIDER=openai`, the default) and for embeddings (if `AI_EMBEDDING_PROVIDER=openai`, the default).
- `ANTHROPIC_API_KEY` — used for text generation if you set `AI_TEXT_PROVIDER=anthropic`. Anthropic doesn't offer an embeddings API, so embeddings always come from OpenAI or Voyage regardless of the text provider.
- `VOYAGE_API_KEY` — only needed if you set `AI_EMBEDDING_PROVIDER=voyage`.

Without any AI keys configured, everything else (accounts, pages, editor, sidebar) still works — the AI features will show a clear "not configured" message instead of failing silently.

Also set `NEXTAUTH_SECRET` to a long random string (`openssl rand -base64 32`).

### 3. Install dependencies and set up the database

```bash
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
```

### 4. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start writing.

## Deploy to Vercel (no local install needed)

1. Sign in at [vercel.com](https://vercel.com) with GitHub, click **Add New → Project**, and import this repository. Don't click Deploy yet.
2. Under **Environment Variables**, add `NEXTAUTH_SECRET` (any long random string). Optionally add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (with `AI_TEXT_PROVIDER=anthropic`) for the AI features.
3. Click **Deploy**. The first build fails because there's no database yet; that's expected.
4. In the project, open **Storage → Create Database → Neon**, accept the defaults, and connect it to the project. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
5. Go to **Deployments**, open the ⋯ menu on the latest deployment, and choose **Redeploy**.

The `vercel-build` script runs the database migrations on every deploy. Don't set `NEXTAUTH_URL` on Vercel; the site address is detected automatically.

## Project structure

```
prisma/schema.prisma          Data model: User, Workspace, Page (tree), PageChunk (embeddings)
src/lib/auth.ts                NextAuth config (Credentials + JWT)
src/lib/ai/                    Swappable AI provider abstraction
  types.ts                     TextProvider / EmbeddingProvider interfaces
  providers/                   OpenAI, Anthropic, OpenAI-embeddings, Voyage-embeddings
  rag.ts                       Chunking, indexing, and retrieval for workspace Q&A
  streamResponse.ts            Turns an AsyncIterable<string> into a streaming Response
src/app/api/
  auth/signup, auth/[...nextauth]   Account creation & sessions
  workspaces, pages                 Workspace + page tree CRUD
  ai/assist                         Streaming writing-assistant endpoint
  ai/chat                           Streaming RAG Q&A endpoint
  workspaces/[id]/tracker, tracker/ Tracker tasks, timer, reminders and settings
  calendar/[token]                  Private calendar feed (.ics) for Google/Outlook
src/components/
  workspace/                   Shared workspace state, shell, search and settings dialogs
  sidebar/                     Page tree with drag and drop, page menu, trash
  page/                        Top bar, cover and icon pickers, comments
  editor/                      BlockNote wrapper, autosave with conflict detection
  ai/                          Inline AI panel, selection toolbar button, workspace chat
  tracker/                     Week board, time tracker, month calendar, reminder settings
  ui/                          Dropdown, menu and modal primitives
src/app/s/[pageId]             Public read-only pages ("Share to web")
src/app/invite/[token]         Workspace invite links
```

## Switching AI providers

Everything AI-related goes through `getTextProvider()` and `getEmbeddingProvider()`
in `src/lib/ai/index.ts`, chosen at request time from `AI_TEXT_PROVIDER` /
`AI_EMBEDDING_PROVIDER`. To add another provider, implement the `TextProvider`
or `EmbeddingProvider` interface in `src/lib/ai/providers/` and wire it into
those two functions — no other code needs to change.

## Notes

- This scaffold uses in-memory cosine similarity over page chunks for
  retrieval (fine for a personal/small-team workspace). For a much larger
  corpus, swap `retrieveRelevantChunks` in `src/lib/ai/rag.ts` for a real
  vector index (e.g. pgvector) without changing any calling code.
- Deleting a page deletes its sub-pages too (cascading).
- Desktop pop-ups need the app open in a browser tab. For reminders when it's closed, use the calendar link. Google Calendar refreshes subscribed calendars slowly (up to a day), and Outlook every few hours.
