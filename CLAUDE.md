# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Liveet is a **rental/housing platform** monorepo with two React Native apps and a shared Convex backend:
- **`apps/native-ten`** — Tenant-facing app (property discovery, move-in, payments, community)
- **`apps/native-op`** — Operator/landlord app (property management, tenant management, payments)
- **`packages/backend`** — Convex serverless backend (shared by both apps)

## Commands

### Root
```bash
pnpm install          # Install all workspace dependencies
```

### Tenant App (`apps/native-ten`)
```bash
npm start             # Start Expo dev server
npm run android       # Run on Android
npm run ios           # Run on iOS
npm run lint          # ESLint
```

### Operator App (`apps/native-op`)
```bash
npm start             # Start Expo dev server
npm run android       # Run on Android
npm run ios           # Run on iOS
npm run lint          # ESLint
```

### Backend (`packages/backend`)
```bash
npm run dev           # Start Convex dev mode (watches and deploys functions)
npm run typecheck     # TypeScript type checking for Convex functions
npm run setup         # Initial setup with retries
```

## Architecture

### Stack
- **Frontend**: React Native + Expo (React 19, RN 0.81), Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Convex (serverless DB + real-time sync + cloud functions)
- **Auth**: Clerk (OAuth, session management)
- **AI**: Google Generative AI (Gemini) for bulk import parsing; OpenAI also integrated
- **Package Manager**: pnpm workspaces

### Routing Pattern (Both Apps)
Both apps use Expo Router with the same guard pattern:
- `app/index.tsx` — Auth redirect (checks Clerk session → routes to `(auth)` or `(app)`)
- `app/(auth)/` — Unauthenticated routes
- `app/(app)/` — Protected routes (tab navigation)
- `app/(onboarding)/` — Operator-only onboarding flow

### Backend (Convex)
All backend logic lives in `packages/backend/convex/`. Convex functions are auto-deployed on `npm run dev`. Key modules:

| Module | Purpose |
|--------|---------|
| `schema.ts` | Single source of truth for all 35+ DB tables and indexes |
| `auth.config.ts` | Clerk authentication provider config |
| `users.ts` | User profiles, onboarding status |
| `properties.ts` | Property/room/floor/amenity management |
| `tenants.ts` | Move-in applications, KYC, room assignments |
| `payments.ts` | Rent transactions and payment tracking |
| `chats.ts` | Real-time tenant-operator messaging |
| `notifications.ts` | Tenant notifications |
| `operatorNotifications.ts` | Operator notifications |
| `complaints.ts` | Complaint filing and resolution |
| `communities.ts` | Social communities, hangouts, meetups |
| `onboarding.ts` | Operator onboarding with AI bulk-import |
| `requests.ts` | Late entry, move-out, room shift requests |
| `bulkImports.ts` | XLSX/CSV import with Gemini AI parsing |

### Data Flow
```
Clerk Auth → Convex Client (real-time queries/mutations) → Convex DB
                    ↓
            Notifications pushed to both apps
```

### Environment Variables
Both apps need `.env.local`:
- `EXPO_PUBLIC_CONVEX_URL` — Convex deployment URL
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key

Backend needs `.env.local`:
- `CONVEX_DEPLOYMENT` — Backend deployment identifier
- `GEMINI_API_KEY` — Google Generative AI key

### Key User Flows
1. **Tenant**: Sign up → browse properties → move-in KYC → pay rent → raise requests/complaints
2. **Operator**: Sign up → onboarding (add property/rooms) → manage tenants → track payments → respond to chats

### Path Aliases
Both apps use `@/*` → root of the app (configured in `tsconfig.json`).

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
