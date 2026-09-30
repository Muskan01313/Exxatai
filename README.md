# Notion AI Clone

A self-hosted, Notion-style workspace with a built-in AI writing assistant and
AI Q&A over your own notes — your own copy of "Notion AI".

## Features

- **Block-based editor** — headings, lists, to-dos, code blocks, drag-to-reorder, slash commands (via [BlockNote](https://www.blocknotejs.org/)).
- **Workspace & page tree** — nested pages, sidebar navigation, create/rename/move/delete.
- **AI writing assistant** — select text and ask AI to continue writing, improve it, fix grammar, make it shorter/longer, summarize, brainstorm, etc. Available from a toolbar button or the `/` slash menu ("Ask AI").
- **AI Q&A over your workspace** — a chat panel that answers questions using your own pages as context (RAG: pages are chunked + embedded on save, retrieved by similarity at query time).
- **Accounts** — email/password auth, each user gets their own workspace(s).
- **Swappable AI provider** — text generation works with either OpenAI or Anthropic; embeddings work with either OpenAI or Voyage AI. Switch via environment variables, no code changes.

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
src/components/
  sidebar/                     Workspace switcher + recursive page tree
  editor/                      BlockNote wrapper, autosave, slash menu
  ai/                          AI assist panel + AI chat panel
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
