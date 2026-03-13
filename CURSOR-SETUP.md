# Cursor IDE — Full Machine Setup Guide

> **Purpose**: Replicate the complete Cursor + macOS development environment from scratch.
> This is a machine-level guide — not project-specific. A new user with zero setup can
> follow this document (or hand Section 10's prompt to Cursor) and end up with an identical
> development environment.
>
> **Reference machine**: macOS 15.5 Sequoia · Apple Silicon (arm64)
> **Last updated**: March 2026

---

## Table of Contents

1. [What This Machine Has](#1-what-this-machine-has)
2. [Why This Stack](#2-why-this-stack)
3. [Cursor IDE — What It Is and Why We Use It](#3-cursor-ide--what-it-is-and-why-we-use-it)
4. [Cursor Extensions](#4-cursor-extensions)
5. [MCP Servers — What They Are and Which Ones We Use](#5-mcp-servers--what-they-are-and-which-ones-we-use)
6. [Cursor Rules — How They Work](#6-cursor-rules--how-they-work)
7. [All Cursor Rule Files (Complete Contents)](#7-all-cursor-rule-files-complete-contents)
8. [CLI Tools Inventory](#8-cli-tools-inventory)
9. [Third-Party Accounts Required](#9-third-party-accounts-required)
10. [Automated Setup Prompt](#10-automated-setup-prompt)

---

## 1. What This Machine Has

### Operating System

| Property | Value |
|----------|-------|
| OS | macOS 15.5 Sequoia |
| Architecture | Apple Silicon arm64 (M-series) |
| Default shell | zsh (Oh My Zsh, `robbyrussell` theme) |
| Package manager | Homebrew |

### Software Installed

**Core runtimes**: Node.js, Python 3.13, Git, zsh

**Platform CLIs** (authenticated to cloud accounts):
- `gh` — GitHub
- `vercel` — Vercel
- `supabase` — Supabase
- `sentry-cli` — Sentry
- `stripe` — Stripe
- `gcloud` — Google Cloud
- `neonctl` — Neon Postgres

**SEO/web analysis**: Lighthouse, Unlighthouse, LHCI, broken-link-checker, next-sitemap, wappalyzer-cli

**Infrastructure**: PostgreSQL 16, Redis, Docker Desktop

**IDE**: Cursor (with Claude Code, Gemini Code Assist, ChatGPT extensions)

**Terminal**: iTerm2

---

## 2. Why This Stack

### Why Cursor (not VS Code, Zed, or Windsurf)

Cursor is a fork of VS Code with deeply integrated AI capabilities. It supports:
- **Agent mode**: the AI reads your codebase, runs terminal commands, edits files, and iterates autonomously.
- **MCP (Model Context Protocol)**: connect external tools (GitHub, Vercel, docs) so the AI can use them directly.
- **Cursor Rules (`.mdc` files)**: persistent behavioral instructions that shape how the AI writes code across every session — your coding standards become the AI's coding standards.
- **Multi-model support**: switch between Claude, GPT, Gemini within one IDE.

No other editor offers all four of these together.

### Why Next.js + TypeScript

Next.js is the most complete React framework — server components, API routes, middleware, file-based routing, ISR, edge runtime, and first-class Vercel deployment. TypeScript in strict mode catches bugs before they reach production.

### Why Tailwind CSS v4

Utility-first styling that eliminates CSS file management. v4 uses `@theme inline` in CSS (no config file), making it simpler. Co-locating styles in JSX keeps components self-contained.

### Why Supabase (not Firebase, Auth0, or raw Postgres)

Open-source Firebase alternative that gives you Postgres (not a proprietary DB), row-level security, realtime subscriptions, auth, edge functions, and a local development CLI — all in one service. You own your data and can migrate away.

### Why Vercel (not Netlify, Railway, or AWS)

Vercel built Next.js. Zero-config deploys, automatic preview URLs per PR, edge functions, and the best developer experience for the Next.js ecosystem. `git push` and you're deployed.

### Why Sentry (not LogRocket, Datadog)

Industry standard for error tracking. Source maps, session replay, performance monitoring, Core Web Vitals, and alert rules. Free tier is generous for small teams.

### Why Langfuse (not LangSmith, Helicone)

Open-source LLM observability. If you're building AI features, you need to trace every completion — tokens, latency, cost, prompt versions. Langfuse is self-hostable and has a generous cloud tier.

### Why Trigger.dev (not BullMQ, Inngest, Quirrel)

TypeScript-native background jobs with a dashboard UI. No Redis to manage. Cron scheduling, retries, and event-driven tasks all in one. Integrates naturally with Next.js.

### Why Resend (not SendGrid, Mailgun)

Built by the creator of `react-email`. Developer-first API, React templates, great deliverability. Simple SDK, generous free tier (3,000 emails/month).

### Why Drizzle + Neon (not Prisma, PlanetScale)

Drizzle is a lightweight, type-safe ORM with zero codegen and SQL-like syntax. Neon is serverless Postgres that scales to zero (no idle costs), has database branching for PR previews, and a native serverless driver that works on Vercel's edge runtime.

### Why Stripe

Industry standard for payments. The CLI enables local webhook testing. Extensive documentation, SDKs for every language, and a test mode that mirrors production exactly.

### Why Google Cloud CLI

Required for SEO automation — Search Console API, Analytics Data API, Analytics Admin API, Site Verification API. Authenticated via `gcloud auth` with application-default credentials.

### Why Serper.dev

Affordable SERP rank tracking API for monitoring Google search positions programmatically. Used by the SEO automation scripts in our projects.

---

## 3. Cursor IDE — What It Is and Why We Use It

Cursor is a code editor (forked from VS Code) with built-in AI capabilities. You install it like any other app. All VS Code extensions, themes, and keybindings work.

What makes Cursor different:

| Feature | What it does |
|---------|-------------|
| **AI Chat** | Ask questions about your codebase. The AI reads your files. |
| **Agent Mode** | The AI writes code, runs commands, creates files, and iterates until the task is done. |
| **Cursor Rules** | `.mdc` files in `~/.cursor/rules/` that tell the AI how you want code written — always. |
| **MCP Servers** | External tools (GitHub, Vercel, docs lookup) the AI can call during a session. |
| **Multi-model** | Use Claude, GPT-4, Gemini, or others. Switch per-session or per-task. |
| **Extensions** | Same extension marketplace as VS Code. |

### Cursor Settings on This Machine

File: `~/Library/Application Support/Cursor/User/settings.json`

```json
{
  "window.commandCenter": true,
  "editor.multiCursorModifier": "ctrlCmd"
}
```

Minimal settings — Cursor's defaults are good. The command center provides quick access to all commands.

---

## 4. Cursor Extensions

| Extension | Publisher | Why |
|-----------|-----------|-----|
| **Claude Code** | Anthropic | Claude is the strongest coding model. Having it as an extension gives you a secondary agent alongside Cursor's built-in AI. |
| **Gemini Code Assist** | Google | Google's coding model with access to up-to-date knowledge. Useful for Google Cloud / Firebase questions. |
| **ChatGPT** | OpenAI | OpenAI's model for a third perspective. Good for brainstorming and general questions. |

All three are free to install. Each requires its own account (see Section 9).

---

## 5. MCP Servers — What They Are and Which Ones We Use

MCP (Model Context Protocol) lets the AI agent inside Cursor call external tools — just like a human would open a browser, check GitHub, or read docs.

Configuration file: `~/.cursor/mcp.json`

### Server 1: Context7 (Library Documentation)

```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

**What it does**: When the AI needs to know how a library works (React 19 hooks, Next.js 16 config, Supabase client setup), it queries Context7 for the latest docs instead of guessing from training data.

**Why**: AI training data is always months behind. This ensures the AI writes code against the *current* version of every library.

**Account needed**: None — it's free and runs locally.

### Server 2: GitHub

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
  }
}
```

**What it does**: The AI can create PRs, branches, issues, review code, search repositories, push files, and merge PRs — all without you leaving Cursor.

**Why**: Eliminates context-switching between IDE and browser for Git operations.

**Account needed**: GitHub account + Personal Access Token (scopes: `repo`, `workflow`, `read:org`, `gist`, `delete_repo`).

### Server 3: Vercel

```json
{
  "url": "https://mcp.vercel.com/sse"
}
```

**What it does**: The AI can check deployment status, manage environment variables, and interact with Vercel projects.

**Why**: Deployment management without leaving the IDE.

**Account needed**: Vercel account (sign in with GitHub).

---

## 6. Cursor Rules — How They Work

Cursor Rules are `.mdc` files stored in `~/.cursor/rules/`. They are **persistent instructions** — every time the AI starts a session, it reads and follows these rules.

Think of them as your team's coding standards, except the AI actually follows them 100% of the time.

### Rule types

| Frontmatter | When it activates |
|-------------|-------------------|
| `alwaysApply: true` | Every session, every file, every project |
| `globs: "**/*.ts"` | Only when working on files matching the pattern |

### Rules on this machine (10 files)

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `foundation-stack.mdc` | Always | Required services (Langfuse, Trigger.dev, Resend, Sentry), default tech stack, architecture pattern |
| 2 | `integrations.mdc` | Always | How services connect: tracing → business logic → background jobs → email |
| 3 | `project-setup.mdc` | Always | 10-step checklist for new projects |
| 4 | `deployment.mdc` | Always | Vercel deployment, GitHub Actions CI, environment management |
| 5 | `testing.mdc` | Always | Vitest for unit tests, Playwright for E2E, CI quality gates |
| 6 | `seo.mdc` | Always | SEO-by-default: metadata, OG tags, sitemap, structured data, GA4 |
| 7 | `seo-tooling.mdc` | `**/seo-tools/**,**/seo-engine/**` | SERP tracking, Google APIs, domain monitoring |
| 8 | `database.mdc` | `**/db/**/*.ts` | Drizzle ORM conventions, schema rules, migrations |
| 9 | `api-routes.mdc` | `**/app/api/**/*.ts` | API handler pattern: auth → validate → trace → respond |
| 10 | `code-quality.mdc` | `**/*.{ts,tsx}` | TypeScript strict, no `any`, no `console.log`, import ordering |

---

## 7. All Cursor Rule Files (Complete Contents)

These are the exact files to place in `~/.cursor/rules/`. Each file is reproduced in full below.

### 7.1 `foundation-stack.mdc`

```
---
description: Foundation services and stack defaults for every project
alwaysApply: true
---

# Foundation Stack

Every new project must include these foundation services unless there is a documented technical reason not to.

## Required Services

| Service | Purpose | Package |
|---------|---------|---------|
| **Langfuse** | LLM observability, tracing, prompt/version tracking | `langfuse` |
| **Trigger.dev** | Background jobs, scheduled tasks, cron, retries, webhooks | `@trigger.dev/sdk` |
| **Resend** | Transactional email, notifications, system messaging | `resend` |
| **Sentry** | Error tracking, performance monitoring, session replay | `@sentry/nextjs` |

## Default Tech Stack

- **Framework**: Next.js (App Router) + TypeScript strict
- **Styling**: Tailwind CSS v4 (inline `@theme`, no config file)
- **Database**: Drizzle ORM + Neon Postgres (`@neondatabase/serverless`)
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Deployment**: Vercel, GitHub Actions CI
- **SEO**: Configured by default on every project (see seo rule)

## Architecture Pattern

src/
  app/           # Next.js pages, layouts, API routes
  components/    # React components (default export only for pages)
  lib/           # Service wrappers — singleton, graceful degradation
    env.ts       # Type-safe env var access with required/optional helpers
    langfuse.ts  # trace(), traceAsync() wrappers
    resend.ts    # sendEmail(), typed templates
    sentry.ts    # captureException(), addBreadcrumb()
  trigger/       # Trigger.dev background jobs and cron
  db/            # Drizzle schema, client, seed
    schema.ts
    client.ts

## Service Wrapper Pattern

Every service wrapper must:
1. Return `null` gracefully when env vars are missing (never crash)
2. Use singleton pattern (don't create new clients per request)
3. Accept config from env vars only (never hardcoded)

## Required Env Vars

LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
TRIGGER_SECRET_KEY
RESEND_API_KEY, RESEND_FROM_EMAIL
NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN
DATABASE_URL

Always create `.env.example` with all vars documented and grouped by service.
```

### 7.2 `integrations.mdc`

```
---
description: How Langfuse, Trigger.dev, and Resend connect together
alwaysApply: true
---

# Service Integration Patterns

## The Standard Flow

Content or data change triggers a pipeline:

User action → API route
  → Langfuse traceAsync() wraps the operation
  → Business logic executes (DB write, computation)
  → Trigger.dev tasks.trigger() fires background job
    → Background job runs with Langfuse span
    → Resend sends notification email
    → On failure: Resend sends error alert

## Langfuse Integration

- Wrap all API route handlers in `traceAsync()`
- Add spans for distinct operations (db write, external API call, email send)
- Tag traces: `["api", "content"]`, `["seo", "scheduled"]`, etc.
- Always flush in finally block: `await lf.flushAsync()`

## Trigger.dev Integration

- Background jobs in `src/trigger/` directory
- Use `task()` for event-driven jobs
- Use `schedules.task()` with cron for periodic work
- Example cron: weekly SEO health check (`0 8 * * 1`)
- Config: `trigger.config.ts` at project root, `maxDuration: 300`
- Reference tasks by ID string: `tasks.trigger<typeof myTask>("task-id", payload)`

## Resend Integration

- Typed email templates in `src/lib/resend.ts`
- Templates: content update notification, error alert
- Tag emails: `{ name: "type", value: "content-update" }` for analytics
- From address from env var with sensible default
- Always non-blocking in API routes (fire via Trigger.dev, don't await inline)

## Cross-Service SEO Strategy

| Service | SEO Role |
|---------|----------|
| Trigger.dev | Sitemap refresh, revalidation, weekly health check, scheduled crawls |
| Resend | Lifecycle emails for acquisition/retention funnels |
| Langfuse | Trace AI-generated content workflows, track content quality |
| Sentry | Monitor Core Web Vitals, track client-side errors affecting UX |
```

### 7.3 `project-setup.mdc`

```
---
description: Checklist for setting up any new project from scratch
alwaysApply: true
---

# New Project Setup Checklist

When starting any new project, execute in this order:

## 1. Scaffold

npx create-next-app@latest <name> --typescript --tailwind --app --src-dir
cd <name>

## 2. Install Foundation

npm install langfuse resend @trigger.dev/sdk @sentry/nextjs drizzle-orm @neondatabase/serverless
npm install -D vitest @playwright/test drizzle-kit

## 3. Create Service Wrappers

Create `src/lib/env.ts`, `langfuse.ts`, `resend.ts`, `sentry.ts` following singleton + graceful null pattern.

## 4. Configure Sentry

- `instrumentation.ts`, `instrumentation-client.ts`
- `sentry.server.config.ts`, `sentry.edge.config.ts`
- Wrap `next.config.ts` with `withSentryConfig()`

## 5. Configure Trigger.dev

- `trigger.config.ts` at root (set `maxDuration`, `dirs`, `retries`)
- Create `src/trigger/` directory

## 6. Configure Database

- `src/db/schema.ts`, `src/db/client.ts`
- `drizzle.config.ts` at root
- `npm run db:generate && npm run db:migrate`

## 7. Configure SEO

- Metadata in `layout.tsx` with title template, OG, Twitter, canonical
- `public/robots.txt` with Sitemap directive
- `src/app/sitemap.ts`
- Structured data component (`StructuredData.tsx`)
- Security headers in `next.config.ts`

## 8. Configure Testing

- `vitest.config.ts` with `@/` alias
- `playwright.config.ts` with webServer auto-start
- Smoke tests in `src/lib/__tests__/`
- E2E tests in `e2e/`

## 9. Configure CI

- `.github/workflows/ci.yml` (typecheck → lint → test → build → e2e)

## 10. Finalize

- `.env.example` with all vars documented
- Verify: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
```

### 7.4 `deployment.mdc`

```
---
description: Deployment, CI/CD, and environment management
alwaysApply: true
---

# Deployment & CI/CD

## Vercel

- Default deployment target for all Next.js projects
- Link project with `vercel link` or `.vercel/project.json`
- Environment variables: set via Vercel dashboard or `vercel env add`
- Never commit `.env.local` — only `.env.example`

## GitHub Actions CI

Every project must have `.github/workflows/ci.yml` with this pipeline:

push/PR to main → typecheck → lint → unit tests → build → E2E tests

Key settings:
- `concurrency` with `cancel-in-progress: true` to avoid redundant runs
- Node.js 22 with npm cache
- Playwright browsers installed with `--with-deps`
- Failed E2E reports uploaded as artifacts (7-day retention)

## Environment Management

| Environment | Purpose | Behavior |
|-------------|---------|----------|
| `development` | Local dev | All services optional (graceful null) |
| `preview` | PR deploys | Full stack, test data allowed |
| `production` | Live site | All secrets required, lower sample rates |

## Sentry Configuration

- `next.config.ts` wrapped with `withSentryConfig()`
- Tunnel route: `/monitoring` (avoids ad blockers)
- Sample rates: 100% in dev, 10% in production
- Session replay: 0% default, 100% on error
- Files: `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

## Security

- `poweredByHeader: false`
- Security headers in `next.config.ts`: HSTS, nosniff, strict referrer, permissions policy
- Never commit secrets, database URLs, or API keys
- Use `src/lib/env.ts` for validated env access
```

### 7.5 `testing.mdc`

```
---
description: Testing standards — Vitest for unit, Playwright for E2E
alwaysApply: true
---

# Testing Standards

## Vitest (Unit / Integration)

- Test file location: colocated in `__tests__/` next to source, or `*.test.ts` suffix
- Config: `vitest.config.ts` at project root with `@/` alias
- Coverage: target `src/lib/` and `src/app/api/`

### What to Test

| Layer | Test what |
|-------|-----------|
| `src/lib/` wrappers | Graceful null when env vars missing, correct defaults |
| Content/data | Data loads, required fields present, types correct |
| API routes | Auth rejection, valid response shape, error handling |
| Business logic | Pure functions, edge cases, error paths |

### What NOT to Test

- React component rendering (use Playwright instead)
- Third-party library internals
- Implementation details (test behavior, not structure)

## Playwright (E2E)

- Config: `playwright.config.ts` at project root
- Test directory: `e2e/`
- Projects: chromium only (add more for full matrix in CI)
- Web server: auto-starts `npm run dev`

### What to Test

- Critical user flows (login, form submission, navigation)
- SEO endpoints (sitemap.xml returns valid XML, robots.txt accessible)
- Meta tags present (OG, canonical, structured data)
- API contract (unauthorized returns 401, valid GET returns expected shape)

## CI Pipeline

Quality gate order: `typecheck → lint → test → build → e2e`

E2E runs after build passes. Failed Playwright reports uploaded as artifacts.

## Scripts

{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

### 7.6 `seo.mdc`

```
---
description: SEO must be configured by default on every project
alwaysApply: true
---

# SEO Standards

SEO is not optional. Every project ships with these configured from day one.

## Minimum SEO Checklist

1. **Metadata** — `title` with template (`%s | Site Name`), `description`, `keywords`, `authors`
2. **Open Graph** — `og:title`, `og:description`, `og:image` (1200x630), `og:url`, `og:type`
3. **Twitter Cards** — `twitter:card`, `twitter:title`, `twitter:image`
4. **Canonical URL** — `<link rel="canonical">` on every page
5. **robots.txt** — `public/robots.txt` with `Sitemap:` directive
6. **sitemap.xml** — `src/app/sitemap.ts` (Next.js native)
7. **Structured Data** — JSON-LD schemas relevant to content type
8. **Security Headers** — HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
9. **Google Analytics** — GA4 via `NEXT_PUBLIC_GA_ID` env var
10. **Search Console** — verification meta tag via env var

## Structured Data Template

Always include `WebSite` with `SearchAction` and `BreadcrumbList` at minimum.

## Performance (affects SEO)

- `poweredByHeader: false` in next.config.ts
- Image formats: AVIF + WebP
- Font loading: `display: "swap"` on all Google Fonts
- Cache headers on sitemap.xml and robots.txt (24h public)

## SEO Automation

- Weekly health check cron via Trigger.dev
- Error alerts via Resend when health check fails
- SERP rank tracking via `seo-engine` CLI

## When Adding New Pages

Every new page route must have:
- Exported `metadata` or `generateMetadata()` function
- Canonical URL
- Appropriate structured data if content-rich
- Entry in sitemap.ts
```

### 7.7 `seo-tooling.mdc`

```
---
description: SEO tooling, SERP tracking, and Google API integrations
globs: "**/seo-tools/**,**/seo-engine/**"
---

# SEO Tooling

## Available CLI Tools

| Command | What it does |
|---------|-------------|
| `npm run serp -- check <domain>` | Quick visibility check (indexation + brand rank) |
| `npm run serp -- rank <domain> [keywords]` | Track keyword positions |
| `npm run serp -- competitors <domain> [keywords]` | Competitor SERP analysis |
| `npm run serp:all` | Full rank report across all configured sites |
| `npm run audit` | SEO audit on live domains |
| `lighthouse <url>` | Core Web Vitals + performance |
| `blc <url>` | Broken link checker |
| `python3 seo-tools/search-console.py` | Google Search Console API |
| `python3 seo-tools/analytics.py` | GA4 API (properties, reports) |

## SERP API

- Provider: Serper.dev (`SERPER_API_KEY` in environment)
- Rate limiting: 200-300ms between requests

## Google APIs (authenticated via `gcloud`)

- Enabled: Search Console, Analytics Data, Analytics Admin, Site Verification
- Python packages: google-api-python-client, google-analytics-data, google-analytics-admin, google-ads

## When Adding a New Site

1. Add domain + keywords to `SITE_KEYWORDS` in serp CLI
2. Run `npm run serp -- check <domain>` to verify indexation
3. Submit sitemap via Search Console
4. Run baseline: `npm run serp -- rank <domain>`
5. Add GA4 property via `analytics.py create <domain>`
```

### 7.8 `database.mdc`

```
---
description: Database conventions — Drizzle ORM + Neon Postgres
globs: "**/db/**/*.ts"
---

# Database Conventions

## Stack

- **ORM**: Drizzle (type-safe, lightweight, no codegen)
- **Database**: Neon Postgres (serverless, branching, scales to zero)
- **Driver**: `@neondatabase/serverless` (works on Vercel edge)

## File Structure

src/db/
  schema.ts    # All table definitions
  client.ts    # Singleton drizzle instance via getDb()
  seed.ts      # Seed script: npx tsx src/db/seed.ts
drizzle/
  0000_*.sql   # Generated migrations (committed to git)
drizzle.config.ts  # Drizzle Kit config at project root

## Schema Rules

- Always include `id` (serial primary key), `createdAt`/`updatedAt` (timestamp with timezone)
- Use `varchar` with explicit length for constrained strings, `text` for unbounded
- Use `jsonb` for flexible data (content sections, metadata)
- Name tables in snake_case, columns in snake_case

## Migrations

- Generate: `npm run db:generate`
- Apply: `npm run db:migrate`
- Browse: `npm run db:studio`
- Seed: `npm run db:seed`

## Content Pattern

When migrating from flat files (JSON) to database:
1. Keep the JSON file as fallback
2. Dual-write: save to both JSON and DB
3. Read from DB with JSON fallback
4. Store revision history in a separate `_revisions` table
```

### 7.9 `api-routes.mdc`

```
---
description: API route conventions for Next.js App Router
globs: "**/app/api/**/*.ts"
---

# API Route Conventions

## Structure

Every API route handler follows this pattern:

import { NextRequest, NextResponse } from "next/server";
import { traceAsync } from "@/lib/langfuse";
import { captureException } from "@/lib/sentry";

export async function POST(req: NextRequest) {
  try {
    const result = await traceAsync("api.endpoint.action", async (t) => {
      // 1. Auth check (fail fast)
      // 2. Validate input (Zod schema)
      // 3. Business logic (traced spans)
      // 4. Fire background work via Trigger.dev
      return { success: true };
    }, {
      metadata: { route: "/api/endpoint" },
      tags: ["api"],
    });
    return NextResponse.json(result);
  } catch (err) {
    captureException(err, { route: "/api/endpoint" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

## Rules

1. **Trace everything** — wrap in `traceAsync()` from `@/lib/langfuse`
2. **Report errors** — `captureException()` from `@/lib/sentry` in every catch
3. **Auth first** — check authorization at top, return 401 immediately
4. **Validate input** — use Zod or runtime checks before processing
5. **Background work** — use `tasks.trigger()` from Trigger.dev, never long-running inline work
6. **Consistent error shape** — always `{ error: string }` with appropriate status code
7. **Type returns** — `NextResponse.json()` only, never raw `Response`
```

### 7.10 `code-quality.mdc`

```
---
description: Code quality and style standards for all TypeScript projects
globs: "**/*.{ts,tsx}"
---

# Code Quality

## TypeScript

- Strict mode always, no `any` unless unavoidable (add `// reason:` comment)
- `const` over `let`, never `var`
- Named exports for utilities, default exports only for page/layout components
- Async/await over `.then()` chains
- Imports order: node builtins → external packages → `@/` internal → relative

## Error Handling

// Bad: silent failures
try { await save(); } catch {}

// Good: trace + report + rethrow or handle
try {
  await save();
} catch (err) {
  captureException(err, { context: "content-save" });
  throw err;
}

## No Debug Noise in Production

- No `console.log` — use Langfuse `trace()` for observability or Sentry `addBreadcrumb()`
- No `console.error` — use `captureException()` from `@/lib/sentry`
- No commented-out code in commits

## Comments

- Explain "why", never "what"
- No narration comments
- Document non-obvious trade-offs, workarounds, or API quirks

## Dependencies

- Install via package manager with latest version
- Never manually write version numbers
- Prefer official SDK/CLI over community wrappers
- Keep dependencies minimal — audit before adding
```

---

## 8. CLI Tools Inventory

### Homebrew Packages

```
ada-url  brotli  c-ares  ca-certificates  fmt  gettext  gh
hdrhistogram_c  icu4c@78  krb5  libnghttp2  libnghttp3  libngtcp2
libunistring  libuv  llhttp  lz4  mpdecimal  node  openssl@3
postgresql@16  powerlevel10k  python@3.13  readline  redis  sentry-cli
simdjson  sqlite  stripe  supabase  uvwasi  xz  zstd
```

### Homebrew Casks

```
docker-desktop  gcloud-cli  iterm2
```

### Global npm Packages

```
@lhci/cli         lighthouse        neonctl           unlighthouse
@nestjs/cli       next-sitemap      vercel            wappalyzer-cli
broken-link-checker  openclaw
```

### Python Packages (key ones from 91 installed)

```
google-api-python-client  google-analytics-data  google-analytics-admin
google-ads  anthropic  scrapy  advertools  pydantic  httpx
pypdf  pyarrow  pyyaml  requests  tldextract
```

### Shell Configuration

- **Shell**: zsh with Oh My Zsh
- **Theme**: robbyrussell
- **Plugins**: git
- **Git identity**: configured via `~/.gitconfig`
- **Git LFS**: enabled

---

## 9. Third-Party Accounts Required

Every account below needs to be created before running the setup. Most offer "Sign in with GitHub" — create GitHub first.

| # | Service | Registration URL | Free Tier | What You Need From It |
|---|---------|-----------------|-----------|----------------------|
| 1 | **GitHub** | https://github.com/signup | Unlimited public/private repos | Username, email, Personal Access Token |
| 2 | **Vercel** | https://vercel.com/signup | 100 GB bandwidth, unlimited deploys | Account (sign in with GitHub) |
| 3 | **Supabase** | https://supabase.com/dashboard | 2 free projects, 500 MB DB | Project URL, Anon Key, Project Ref |
| 4 | **Sentry** | https://sentry.io/signup/ | 5K errors/month | DSN, Org slug, Project slug, Auth Token |
| 5 | **Neon** | https://neon.tech/ | 1 free project, 0.5 GB | DATABASE_URL connection string |
| 6 | **Stripe** | https://dashboard.stripe.com/register | Full test mode free | Secret Key, Publishable Key |
| 7 | **Google Cloud** | https://console.cloud.google.com/ | $300 free credits | Project ID, enabled APIs |
| 8 | **Serper.dev** | https://serper.dev/ | 2,500 free searches | API key |
| 9 | **Langfuse** | https://cloud.langfuse.com/ | 50K observations/month | Public Key, Secret Key |
| 10 | **Trigger.dev** | https://cloud.trigger.dev/ | 5,000 runs/month | Secret Key |
| 11 | **Resend** | https://resend.com/signup | 3,000 emails/month | API key, verified domain |
| 12 | **Anthropic** (optional) | https://console.anthropic.com/ | Pay-per-use | For Claude Code extension |
| 13 | **OpenAI** (optional) | https://platform.openai.com/ | Pay-per-use | For ChatGPT extension |
| 14 | **Google AI** (optional) | https://aistudio.google.com/ | Free tier available | For Gemini Code Assist |

---

## 10. Automated Setup Prompt

**Copy everything below and paste it into Cursor's AI chat on a brand-new Mac.** The AI will walk you through each step, pausing at every account registration to let you complete it before continuing.

---

````
You are setting up a complete macOS development environment for a new developer.
This is a machine-level setup — not for one project, but for all future projects.

IMPORTANT RULES:
- Run every install command yourself via the terminal.
- After each "PAUSE" instruction, stop and ask me to confirm before continuing.
- When I need to register for a service, give me the URL and tell me exactly what
  credentials/keys to copy. Wait for me to confirm I have them.
- Use Homebrew for everything possible.
- Do NOT skip steps or combine phases.
- After each phase, run a verification command and show me the result.

====================================================================
PHASE 1: HOMEBREW + CORE RUNTIMES
====================================================================

1. Install Homebrew:
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

   After install, run the two lines Homebrew prints to add it to PATH.

2. Install core tools:
   brew install node python@3.13 git gh

3. Verify:
   node --version && npm --version && python3 --version && git --version && gh --version

PAUSE — show me the versions before continuing.

====================================================================
PHASE 2: SHELL CONFIGURATION
====================================================================

1. Install Oh My Zsh:
   sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

2. The default theme (robbyrussell) and git plugin are fine. No changes needed.

3. Verify:
   echo $ZSH_THEME  # should show "robbyrussell"

====================================================================
PHASE 3: GITHUB — REGISTER & CONNECT
====================================================================

PAUSE — I need to register for GitHub.

Go to: https://github.com/signup
- Create an account (or sign in if you have one)
- Note your username and email

Then authenticate the CLI:
   gh auth login
   → Choose: GitHub.com → HTTPS → Login with web browser

Configure Git identity:
   git config --global user.name "YOUR_NAME"
   git config --global user.email "YOUR_EMAIL"

Create a Personal Access Token:
   Go to: https://github.com/settings/tokens
   → Generate new token (classic)
   → Select scopes: repo, workflow, read:org, gist, delete_repo
   → Copy the token and save it somewhere safe — you'll need it for MCP config

Verify:
   gh auth status

PAUSE — confirm GitHub is connected.

====================================================================
PHASE 4: PLATFORM CLIs — REGISTER & CONNECT EACH SERVICE
====================================================================

4A. VERCEL
----------
PAUSE — I need to register for Vercel.

Go to: https://vercel.com/signup (sign in with GitHub)

Install and authenticate:
   npm install -g vercel
   vercel login

Verify:
   vercel whoami

4B. SUPABASE
------------
PAUSE — I need to register for Supabase.

Go to: https://supabase.com/dashboard (sign in with GitHub)
- Create a new organization
- Create a new project — note the:
  - Project URL (looks like https://xxxxx.supabase.co)
  - Anon Key (public)
  - Project Reference ID

Install and authenticate:
   brew install supabase/tap/supabase
   supabase login

Verify:
   supabase --version

4C. SENTRY
----------
PAUSE — I need to register for Sentry.

Go to: https://sentry.io/signup/ (sign in with GitHub)
- Create an organization
- Create a Next.js project — note the:
  - DSN (looks like https://xxx@xxx.ingest.sentry.io/xxx)
  - Organization slug
  - Project slug
- Go to Settings → Auth Tokens → Create new token

Install and authenticate:
   brew install getsentry/tools/sentry-cli
   sentry-cli login

Verify:
   sentry-cli --version

4D. NEON
--------
PAUSE — I need to register for Neon.

Go to: https://neon.tech/ (sign in with GitHub)
- Create a project → note the DATABASE_URL connection string

Install and authenticate:
   npm install -g neonctl
   neonctl auth

Verify:
   neonctl --version

4E. STRIPE
----------
PAUSE — I need to register for Stripe.

Go to: https://dashboard.stripe.com/register
- Complete registration — note from the Developers → API Keys page:
  - Publishable key (pk_test_xxx)
  - Secret key (sk_test_xxx)

Install and authenticate:
   brew install stripe/stripe-cli/stripe
   stripe login

Verify:
   stripe --version

4F. GOOGLE CLOUD
----------------
PAUSE — I need to register for Google Cloud.

Go to: https://console.cloud.google.com/
- Create a new project
- Enable these APIs (search for each in the API Library):
  - Search Console API
  - Google Analytics Data API
  - Google Analytics Admin API
  - Site Verification API

Install and authenticate:
   brew install --cask google-cloud-sdk
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth application-default login

Verify:
   gcloud config get project

4G. SERPER.DEV
--------------
PAUSE — I need to register for Serper.dev.

Go to: https://serper.dev/
- Sign up and copy your API key from the dashboard
- Save it — you'll add it to project .env files as SERPER_API_KEY

No CLI needed.

4H. LANGFUSE
-------------
PAUSE — I need to register for Langfuse.

Go to: https://cloud.langfuse.com/
- Sign up (with GitHub or email)
- Create a project → Go to Settings → API Keys
- Note: Public Key, Secret Key, and the Host URL

No CLI needed — used via npm package in projects.

4I. TRIGGER.DEV
---------------
PAUSE — I need to register for Trigger.dev.

Go to: https://cloud.trigger.dev/ (sign in with GitHub)
- Create a project → note the Secret Key from the project settings

No CLI needed globally — used via @trigger.dev/sdk in projects.

4J. RESEND
----------
PAUSE — I need to register for Resend.

Go to: https://resend.com/signup (sign in with GitHub)
- Go to API Keys → Create API Key → copy it
- Go to Domains → Add a domain (or use the free onboarding domain for testing)

No CLI needed — used via npm package in projects.

====================================================================
PHASE 5: INFRASTRUCTURE TOOLS
====================================================================

Install database and container tools:
   brew install postgresql@16 redis
   brew install --cask docker

Open Docker Desktop once to complete its setup.

Verify:
   psql --version && redis-cli --version && docker --version

====================================================================
PHASE 6: SEO & WEB ANALYSIS TOOLS
====================================================================

Install globally:
   npm install -g lighthouse @lhci/cli unlighthouse broken-link-checker next-sitemap wappalyzer-cli

Verify:
   lighthouse --version && blc --version

====================================================================
PHASE 7: PYTHON PACKAGES
====================================================================

Install key Python packages:
   pip3 install google-api-python-client google-analytics-data \
     google-analytics-admin google-ads anthropic scrapy advertools \
     pydantic httpx pypdf pyarrow pyyaml requests tldextract

Verify:
   pip3 list | grep google

====================================================================
PHASE 8: TERMINAL
====================================================================

Install iTerm2:
   brew install --cask iterm2

====================================================================
PHASE 9: CURSOR IDE CONFIGURATION
====================================================================

9A. EXTENSIONS
--------------
Open Cursor. Go to Extensions (Cmd+Shift+X) and install:
- "Claude" by Anthropic
- "Gemini Code Assist" by Google
- "ChatGPT" by OpenAI

PAUSE — confirm extensions are installed.

9B. MCP SERVERS
---------------
Create the MCP configuration file:

mkdir -p ~/.cursor
cat > ~/.cursor/mcp.json << 'MCPEOF'
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "REPLACE_WITH_YOUR_GITHUB_TOKEN"
      }
    },
    "vercel": {
      "url": "https://mcp.vercel.com/sse"
    }
  }
}
MCPEOF

IMPORTANT: Now edit ~/.cursor/mcp.json and replace REPLACE_WITH_YOUR_GITHUB_TOKEN
with the Personal Access Token you created in Phase 3.

PAUSE — confirm you've added your token.

Restart Cursor for MCP servers to activate.

9C. CURSOR RULES
-----------------
Create the rules directory and all 10 rule files:

mkdir -p ~/.cursor/rules

Write each of these 10 files. The contents are provided in Section 7 of the
CURSOR-SETUP.md document. Create them as:

~/.cursor/rules/foundation-stack.mdc
~/.cursor/rules/integrations.mdc
~/.cursor/rules/project-setup.mdc
~/.cursor/rules/deployment.mdc
~/.cursor/rules/testing.mdc
~/.cursor/rules/seo.mdc
~/.cursor/rules/seo-tooling.mdc
~/.cursor/rules/database.mdc
~/.cursor/rules/api-routes.mdc
~/.cursor/rules/code-quality.mdc

Each file must start with YAML frontmatter (---) containing `description` and either
`alwaysApply: true` or `globs: "pattern"`.

The complete contents of all 10 files are in Section 7 of this document.

PAUSE — confirm all 10 rule files exist:
   ls ~/.cursor/rules/

====================================================================
PHASE 10: FINAL VERIFICATION
====================================================================

Run this verification script:

echo "=== Core Tools ==="
node --version
npm --version
python3 --version
git --version

echo "=== Platform CLIs ==="
gh auth status 2>&1 | head -3
vercel whoami
supabase --version
sentry-cli --version
stripe --version
gcloud config get project
neonctl --version

echo "=== Infrastructure ==="
psql --version
redis-cli --version
docker --version

echo "=== SEO Tools ==="
lighthouse --version
blc --version 2>&1 | head -1

echo "=== Cursor Config ==="
ls ~/.cursor/rules/ | wc -l    # should be 10
cat ~/.cursor/mcp.json | head -3

echo "=== Done ==="

Every command should succeed. If any fails, investigate before proceeding.

You are now ready to start any project. Open Cursor, press Cmd+L to chat,
and tell the AI what you want to build. The rules will guide it automatically.
````

---

*End of document.*
