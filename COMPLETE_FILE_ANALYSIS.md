# Complete File Analysis — respro Project

**Generated:** September 11, 2026  
**Project:** respro (Lalithaditya007/projectX)  
**Scope:** Full codebase analysis with improvement recommendations

---

## File Inventory & Analysis

### 📦 Project Root

| File | Size | Status | Notes |
|------|------|--------|-------|
| `.git/` | — | ✅ | Repository history intact |
| `.gitignore` | Small | ⚠️ | **Missing entries for:** `client/dist/`, `server/.cache/`, `server/playbooks/` |
| `README.md` | ~2 KB | ⚠️ | **Stale:** Claims Claude API, documents ports 3001 |
| `CHATGPT_PROMPT.md` | — | ℹ️ | Auxiliary (for generating copy) |
| `pitch.md` | — | ✅ | Hackathon pitch deck |
| `respro logo.jpeg` | — | ✅ | Branding asset |
| `*.png` (5 images) | — | ✅ | Screenshots for README |

**Action Items:**
- ✏️ Update `.gitignore`
- ✏️ Fix `README.md`

---

### 📁 `/client` — React Frontend (Vite 5)

#### Configuration & Entry
| File | Lines | Quality | Notes |
|------|-------|---------|-------|
| `package.json` | ~30 | ✅ | Clean dependencies, no unused pkgs |
| `vite.config.js` | ~15 | ⚠️ | **Proxy target hardcoded to 3002** (inconsistent with server:3003) |
| `tailwind.config.js` | ~80 | ✅ | Extended theme (brand/accent/surface/pulse palettes) |
| `postcss.config.js` | ~5 | ✅ | Standard setup |
| `index.html` | ~25 | ⚠️ | **Loads Tailwind v4 CDN AND compiles v3 via PostCSS** (duplication) |
| `public/respro-logo.jpeg` | — | ✅ | Static asset |

**Issues:**
- **D1:** Vite proxy points to 3002, server runs on 3003 → connection fails
- **D10:** Tailwind v3 via PostCSS + v4 via CDN = duplicate styles

**Recommendation:**
- Use v3 only (production build); remove CDN link

---

#### Main App & Pages

| File | Lines | Responsibility | Quality | Issues |
|------|-------|-----------------|---------|--------|
| `src/main.jsx` | ~15 | ReactDOM root + QueryClient setup | ✅ Good | — |
| `src/App.jsx` | ~200 | Shell, routing, SSE wiring, auth state | ⚠️ OK | **D9:** TDZ bug: `handleForceRefresh` refs `repoData` before declaration |
| `src/index.css` | ~150 | Tailwind imports + custom components | ✅ Good | Consider splitting into modules |
| `src/utils/api.js` | ~250 | **THE HTTP client** — all fetch calls | ✅ Excellent | Single source of truth; well-structured |

**App.jsx Structure:**
- Mounts `QueryClientProvider`
- `useEffect` for SSE connection (listens to `playbook`, `summary`, `board_task_moved`, etc.)
- Renders sidebar + page router
- Auth state from `localStorage`

---

#### Pages (6 files, each ~200–400 lines)

| Page | Component | Fetches | Features | Quality |
|------|-----------|---------|----------|---------|
| `LandingPage.jsx` | Sign-in + repo selector | None (OAuth redirect) | GitHub OAuth flow | ✅ |
| `OverviewPage.jsx` | Dashboard tiles | Pulse data | Health score, contributors, branches, PRs, issues | ✅ |
| `InsightsPage.jsx` | Analytics deep dive | Playbook, health, collisions | Collision radar + health checkup **inline** (using dead components' logic) | ⚠️ Duplicated logic |
| `ActivityPage.jsx` | Timeline view | Recent commits, heatmaps | Activity heatmap, branch timeline | ✅ |
| `CollaborationPage.jsx` | Team insights | Collision data | Contributor heatmap, collision list **inline** | ⚠️ Duplicated logic |
| `TasksPage.jsx` | Kanban board | Board data | Drag-drop tasks, deadline flags | ✅ Good |

**Issues:**
- **D8:** `CollisionRadarPanel.jsx` and `HealthCheckupPanel.jsx` exist but unused; their logic is re-implemented inline in InsightsPage/CollaborationPage
- Refactor candidates: extract collision & health rendering into shared hooks

---

#### Components (30 files, ~50–600 lines each)

**Presentational Components (purely render props):**
- `StatsGrid.jsx` (stats cards)
- `BranchList.jsx` (branch table)
- `IssueList.jsx` (issues table)
- `PullRequestList.jsx` (PR table)
- `CommitList.jsx` (commits table)
- `ContributorList.jsx` (contributor cards)
- `CommitSummaryCard.jsx` (single commit summary card)
- `TaskCard.jsx` (Kanban task card)
- `ErrorDisplay.jsx` (error banner)
- `LoadingState.jsx` (skeleton loaders)

**Quality:** ✅ All use `prop-types` validation consistently.

**Container / Smart Components (self-fetching or stateful):**
- `KanbanBoard.jsx` — Uses TanStack Query for board fetch, `@dnd-kit/sortable` for drag-drop, internal task modal
- `ChatPanel.jsx` — Streaming chat via SSE, message history, markdown rendering
- `PlaybookPanel.jsx` — Displays playbook entries, links to commits
- `LiveEventToast.jsx` — SSE event notifications

**Quality:** ✅ Good separation; components do one thing well.

**Special Components:**
- `AuthButton.jsx` (600+ lines) — **Unused.** Full OAuth button + GitHub repo selection widget. Logic moved to pages.
- `CollisionRadarPanel.jsx` (626 lines) — **Unused.** Full collision detail view with resolution actions. Logic moved inline to InsightsPage.
- `HealthCheckupPanel.jsx` (426 lines) — **Unused.** Full health checkup scorecard. Logic moved inline to InsightsPage.
- `RepoSelector.jsx` — Repo picker dropdown (used)
- `RepoInput.jsx` — Manual repo URL input (used)
- `Sidebar.jsx` — Navigation sidebar (used)
- `ContributorHeatmap.jsx` — Recharts-like heatmap (custom SVG)
- `ContributorFlagBadge.jsx` — Flag badge for overdue tasks
- `ActivityHeatmap.jsx` — Commit activity heatmap (custom CSS grid)
- `GitGraph.jsx` & `GitGraphPanel.jsx` — Branch visualization (custom SVG)
- `DeadlineWarningBanner.jsx` — "Task due soon" banner
- `BlockerPanel.jsx` — Blocker list & suggested actions

**Dead Code:**
- ✏️ **Action:** Remove or refactor `AuthButton.jsx`, `CollisionRadarPanel.jsx`, `HealthCheckupPanel.jsx`; consolidate logic into shared hooks

**Recharts Status:**
- Declared in `package.json`
- **NOT imported anywhere** — all charts are hand-rolled SVG/CSS
- ✏️ **Action:** Remove from dependencies if not planned

---

### 📁 `/server` — Express API (Node.js ESM)

#### Configuration & Entry
| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `package.json` | ~25 | ⚠️ | **Dead deps:** `@anthropic-ai/sdk`, `node-cache`; ESM via `"type": "module"` |
| `index.js` | ~80 | ⚠️ | Port hardcoded to 3003 (should be 3002 or env-based); session uses MemoryStore |

**Issues:**
- **D1:** Port 3003 conflicts with client proxy (3002)
- **D5:** Unused dependencies (@anthropic-ai/sdk, node-cache)
- **D7:** MemoryStore loses sessions on restart

---

#### Routes (7 files, thin HTTP layers)

| Route | Verb | Responsibility | Quality | Issues |
|-------|------|-----------------|---------|--------|
| `auth.js` (252 L) | `GET /api/auth/github` | OAuth initiation | ✅ Good | Lazy `getWebhookSecret()` is a code smell; should remove after webhook fix |
| | `GET /api/auth/github/callback` | OAuth callback + token exchange | ✅ Good | Failure paths redirect with `?auth_error` (not JSON) — OK for UI |
| | `GET /api/auth/user` | Boot auth probe | ✅ Good | — |
| | `GET /api/auth/repos` | List user's repos | ✅ Good | Limited to 50 (GitHub default) |
| | `POST /api/auth/webhook` | One-click webhook install | ✅ Good | Treats 422 as success ("already exists") |
| | `POST /api/auth/logout` | Destroy session | ✅ Good | — |
| `pulse.js` (391 L) | `POST /api/pulse` | **Core entry point** | ⚠️ Complex | Respond-first, compute-later pattern; long processing pipeline |
| | `POST /api/chat` | SSE streaming chat | ✅ Good | Injects context server-side; **D3:** collision schema mismatch |
| | `POST /api/commit/analyze` | Single commit analysis | ✅ Good | Caches by commit SHA |
| | `GET /api/repos/:o/:r/contributors/:u/commits` | Contributor's recent commits | ✅ Good | Direct GitHub call (bypasses githubService) |
| | `GET /api/events/:o/:r` | SSE feed | ✅ Good | 30s keep-alive ping; clean registry |
| `playbook.js` (148 L) | `GET /api/playbook/:o/:r` | Full store (project + contributors) | ✅ Good | — |
| | `GET /api/playbook/:o/:r/commit/:sha` | Commit lookup (by SHA, prefix, shortId) | ✅ Good | — |
| | `GET /api/playbook/:o/:r/commits/status` | Analysis progress | ✅ Good | — |
| | `POST /api/playbook/:o/:r/analyze` | Enqueue for background analysis | ✅ Good | — |
| | `GET /api/playbook/analysis/queue` | Global queue status | ✅ Good | — |
| `board.js` (233 L) | All endpoints | Kanban CRUD | ✅ Good | Self-assign only (enforced server-side); ownership gating on create/delete/update |
| | `POST /api/board/:o/:r/tasks` | Create task | ✅ Good | Validates deadline is not in past |
| | `PATCH /api/board/:o/:r/tasks/:id` | Update task | ✅ Good | — |
| | `DELETE /api/board/:o/:r/tasks/:id` | Delete task | ✅ Good | Owner-gated |
| | `PATCH /api/board/:o/:r/tasks/:id/move` | Drag task to column | ✅ Good | **Intentionally NOT owner-gated** (collaborative) |
| | `GET /api/board/:o/:r/warnings`, `.../flags` | Task warnings/flags | ✅ Good | — |
| `collision.js` (121 L) | `GET /api/collision/:o/:r` | Full collision report | ✅ Good | Uses `collisionService.detectFileCollisions()` |
| | `GET /api/collision/:o/:r/summary` | Lightweight tile summary | ✅ Good | — |
| | `PATCH /api/collision/:o/:r/resolve/:id` | Mark collision as resolved | ✅ Good | Stamps `resolvedBy` from session |
| | `PATCH /api/collision/:o/:r/unresolve/:id` | Undo resolution | ✅ Good | — |
| `health.js` (44 L) | `GET /api/health/:o/:r` | Health checkup | ✅ Good | Thin wrapper |
| `webhook.js` (279 L) | `POST /api/webhook/:o/:r` | GitHub webhook receiver | ⚠️ Critical issue | **D2:** Signature verification silently disabled (WEBHOOK_SECRET captured at module load) |

**Key Architectural Pattern:**
Most routes:
1. Validate input
2. Return immediately with status 200 + data (or `processing: true`)
3. Spawn un-awaited background task → broadcasts results over SSE

This is the *"respond first, compute later"* strategy — correct for long-running AI work.

---

#### Services (13 files, all business logic)

| Service | Lines | Purpose | Quality | Issues |
|---------|-------|---------|---------|--------|
| `githubService.js` | 593 | **GitHub adapter** — normalizes GitHub REST responses | ✅ Excellent | Single choke point; all GitHub logic here; good error translation |
| `cacheService.js` | 189 | SHA-versioned cache + disk mirror | ✅ Good | Debounced 1s disk write; simple but effective |
| `ollamaService.js` | 254 | Pulse summarizer (AI health summary) | ✅ Good | Clean API; good error messages |
| `chatService.js` | 289 | Conversational AI with repo context | ⚠️ Good but buggy | **D3:** Reads wrong collision field names → empty context |
| `commitSummarizer.js` | 255 | Diff chunking + playbook prose generation | ✅ Good | Shared `callOllama()` pattern; `<think>` block stripping |
| `commitAnalyzerService.js` | ~400 | Per-commit AI analysis | ✅ Good | Chunks large diffs, retries on JSON parse failure |
| `playbookService.js` | 461 | Durable knowledge store (JSON file I/O) | ⚠️ Functional but unsafe | **D6:** No file locking on read-modify-write; data loss risk at scale |
| `collisionService.js` | 694 | **Most algorithmic** — line/function/file overlap detection | ✅ Excellent | 3-day time window; hunk-level regex parsing; severity scoring |
| `healthService.js` | ~250 | Health checkup scoring | ✅ Good | Deterministic formula: Collaboration×0.35 + Velocity×0.35 + BusFactor×0.30 |
| `boardService.js` | ~350 | Kanban board logic | ✅ Good | File-backed JSON; PR-driven auto-transitions |
| `sseService.js` | ~100 | SSE registry + broadcast | ✅ Clean | `Map<repoKey, Set<response>>` pattern; 12 event types |
| `pollingService.js` | ~150 | 30s fallback poller | ✅ Good | Runs if webhooks unavailable; independent fallback |
| `backgroundAnalyzerService.js` | ~200 | Analysis queue manager | ⚠️ OK but fragile | Hand-rolled scheduler; `MAX_CONCURRENT=2`, `COMMIT_DELAY_MS=2000`; matches placeholder strings to detect failures |

**Architecture Notes:**
- Services are pure ESM modules with named exports + redundant `export default {...}`
- Some circular dependency risk (e.g., `playbookService` ↔ `collisionService`), mitigated by function-level imports
- All services read GitHub directly OR read playbook store; no caching between services

**Issue Severity:**
- 🔴 **D6** (concurrent writes) — will cause data loss under webhook load
- 🟠 **D3** (chat schema) — cripples AI assistant

---

#### Data Directories (Runtime-Generated)

| Path | Contents | Issues |
|------|----------|--------|
| `.cache/pulse-cache.json` | 1,696 lines | **Committed to repo** (should gitignore); SHA-versioned cache |
| `playbooks/` | 13 analyzed repos | **Committed to repo** (should gitignore); includes real Microsoft/llvm data; project.json + per-contributor + board.json per repo |

---

### 📊 Dependency Analysis

#### Server `package.json`
```json
{
  "@anthropic-ai/sdk": "^0.24.0",  // ❌ UNUSED — import not found anywhere
  "cors": "^2.8.5",                 // ✅ Used: CORS middleware
  "dotenv": "^16.3.1",              // ✅ Used: env config
  "express": "^4.18.2",             // ✅ Used: HTTP server
  "express-session": "^1.19.0",     // ✅ Used: session management
  "node-cache": "^5.1.2"            // ❌ UNUSED — import not found anywhere
}
```

**Dead Code:**
- Remove `@anthropic-ai/sdk` (v0.24.0)
- Remove `node-cache` (v5.1.2)

#### Client `package.json`
```json
{
  "@dnd-kit/core": "...",           // ✅ Used: Kanban drag-drop
  "@dnd-kit/sortable": "...",       // ✅ Used: Sortable items
  "@tanstack/react-query": "^5.x",  // ✅ Used: pulse mutation, board query
  "prop-types": "...",              // ✅ Used: component validation
  "react": "^18.x",                 // ✅ Used: core
  "react-dom": "^18.x",             // ✅ Used: rendering
  "react-markdown": "...",          // ✅ Used: chat response rendering
  "recharts": "...",                // ❌ UNUSED — declared but NO imports found
  "vite": "^5.x"                    // ✅ Used: build tool
}
```

**Dead Code:**
- Remove `recharts` (not imported anywhere; charts are hand-rolled SVG)

---

## Quality Metrics

### Code Organization

| Metric | Value | Assessment |
|--------|-------|-----------|
| Routes files | 7 | ✅ Good separation |
| Services files | 13 | ✅ Good separation |
| Components | 30 | ⚠️ Some unused (3 dead) |
| Lines per file (avg) | 200–400 | ✅ Reasonable |
| Circular imports | ~2 | ⚠️ Mitigated by lazy imports |
| Test coverage | 0% | 🔴 None |

### Error Handling

| Aspect | Status |
|--------|--------|
| HTTP error codes | ✅ Mapped correctly (404 → REPO_NOT_FOUND, 429 → RATE_LIMITED, etc.) |
| Timeout handling | ✅ Ollama requests have AbortController + 180s–300s timeouts |
| Fallback behavior | ✅ Poller falls back when webhooks unavailable |
| Graceful degradation | ⚠️ Missing: session fallback when MemoryStore is empty |

### Security

| Aspect | Status | Issue |
|--------|--------|-------|
| Authentication | ✅ GitHub OAuth + session | — |
| Authorization | ✅ Self-assign only, ownership gating | — |
| Webhook signature | 🔴 **Disabled** | **D2:** Secret captured at module load |
| Rate limiting | ⚠️ Inherited from GitHub | No app-level throttling |
| CORS | ✅ Restricted to CLIENT_URL | — |
| HTTPS | ⚠️ Dev only (secure: false) | OK for development |

---

## Recommendations by Category

### 🔴 Critical (Blocker — fix before demo)

1. **Fix port drift** (1.5 → 1a) — 15 min
2. **Fix webhook verification** (2 → 2.1) — 30 min
3. **Fix chat schema** (3 → 3.1) — 20 min
4. **Update README** (4 → 4.1) — 10 min

### 🟠 High Priority (Before production)

5. **Remove dead dependencies** (5 → 5.1) — 5 min
6. **Update .gitignore** (6 → 6.1) — 10 min
7. **Add file locking or migrate to SQLite** (D6) — 2–4 hours
8. **Move sessions to persistent store** (D7) — 1 hour

### 🟡 Medium Priority (Before Tier 1 features)

9. **Remove/consolidate dead components** (D8) — 1 hour
10. **Add shared schema layer (Zod)** — 2 hours
11. **Add test fixtures + snapshots** — 3 hours

### 🟢 Nice to Have (Polish)

12. Remove `recharts` from dependencies (not used) — 2 min
13. Fix Tailwind v3/v4 duplication — 15 min
14. Split `index.css` into component modules — 30 min

---

## Implementation Sequence

### Sprint 1: Credibility (This Week)
1. All critical fixes (§4.1–4.4): ~1 hour
2. All high-priority quick fixes (§5–6): ~30 min
3. Test everything: ~30 min
4. **Result:** Fresh clone works, security verified

### Sprint 2: Foundation (Week 2)
1. SQLite migration: ~6–8 hours
2. Shared schema layer: ~2 hours
3. Remove dead components: ~1 hour
4. Add test fixtures: ~3 hours
5. **Result:** Scalable, testable foundation

### Sprint 3: Tier 1 Features (Weeks 3–4)
1. Merge Forecast: ~8–12 hours
2. Temporal RAG: ~10–14 hours
3. **Result:** Defensible differentiation

---

## File Checklist for Developers

### Before Making Changes

- [ ] Review this analysis for the component/service you're editing
- [ ] Check if there's a circular dependency risk
- [ ] Use shared schemas (when Zod layer is added)
- [ ] Add test coverage if modifying core logic

### Before Committing

- [ ] Lint: `npm run lint` (if configured)
- [ ] Format: `prettier --write .` (if configured)
- [ ] Test: `npm test` (if tests exist)
- [ ] No unused imports
- [ ] No console.log in production code

### Before Deploying

- [ ] All Tier 0 defects fixed
- [ ] `.gitignore` excludes build output & data
- [ ] `.env.example` documented
- [ ] README accurate
- [ ] One port used consistently

---

## Conclusion

respro is **well-architected for its scope**, with clear separation between HTTP (routes), business logic (services), and UI (pages/components). The main issues are:
- **Configuration fragility** (port mismatch)
- **Security gap** (webhook verification)
- **Data integrity risk** (concurrent writes)
- **Dead code** (3 unused components)
- **Documentation rot** (README claims Claude)

**Fixing these (~5 hours) makes the project production-ready. Then Tier 1 features are a clear 10x improvement.**

