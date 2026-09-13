# respro Project Analysis & Upgrade Roadmap

**Date:** September 11, 2026  
**Project:** respro - *"The brain behind your branches"*  
**Location:** `c:\Users\resma\Documents\WORKSHOP\respro`

---

## Executive Summary

respro is a **powerful, innovative GitHub intelligence dashboard** with three genuine differentiators:
1. **The Playbook** — durable semantic memory of every commit's intent and impact
2. **Collision Radar** — pre-merge conflict detection at line/function level
3. **Local-first privacy** — all AI inference runs on your machine via Ollama, no cloud data loss

**Current Status:** ⚠️ **Highly functional but has credibility-blocking defects** that must be fixed before any production deployment or major demo.

**YES—the roadmap features WILL dramatically upgrade this project**, but only if Tier 0 (critical fixes) are completed first. This report prioritizes and sequences the work.

---

## 1. Current State Assessment

### 1.1 What's Working Well ✅

| Component | Status | Quality |
|-----------|--------|---------|
| Core playbook ingestion & analysis | ✅ Implemented | Solid—reads diffs, generates semantic summaries |
| Collision detection algorithm | ✅ Implemented | Excellent—hunk-level regex parsing + overlap scoring |
| SSE real-time broadcast | ✅ Implemented | Clean event registry pattern |
| Kanban board with drag-drop | ✅ Implemented | Full CRUD + PR-driven auto-transitions |
| GitHub OAuth + repo list | ✅ Implemented | Standard flow, working |
| Chat assistant | ✅ Implemented | Context injection works; needs schema fix (see defects) |
| Health checkup scoring | ✅ Implemented | Deterministic multi-factor formula |

### 1.2 Critical Defects (Tier 0) 🔴

| # | Issue | Location | Impact | Effort |
|----|-------|----------|--------|--------|
| **D1** | **Port Mismatch** — Server 3003, Vite proxy 3002, README 3001; fresh clone cannot run | `server/index.js:17`, `client/vite.config.js:8`, `README.md` | **Blocker** — cannot demo | 10 min |
| **D2** | **Webhook signature verification silently disabled** — `WEBHOOK_SECRET` captured at module load before `auth.js` sets it; verification always skipped | `server/routes/webhook.js:16` vs `server/routes/auth.js:20–22` | **Security** — webhooks unverified | 30 min |
| **D3** | **Chat receives wrong collision schema** — `chatService` reads `status`, `contributor1`, `contributor2`, `hz.file`; producer emits `isResolved`, `authors[]`, `hz.area` → empty context | `server/services/chatService.js:80–100` vs `server/services/collisionService.js` | AI context empty; chat is crippled | 20 min |
| **D4** | **README claims Claude, code is Ollama-only** — README lists Anthropic as AI stack; no Anthropic code path exists; all 60 matches are `OLLAMA_` | `README.md` vs all `/services/*.js` | **Credibility loss** — looks abandoned | 5 min |
| **D5** | **Unused dependencies installed** — `@anthropic-ai/sdk` and `node-cache` declared but never imported | `server/package.json` | Confusion, bloat | 2 min |
| **D6** | **Concurrent write corruption risk** — `playbookService` does read-modify-write on `project.json` without locking; two webhooks in same second lose data | `server/services/playbookService.js:350–365` | Data loss under load | 2 hours (full fix with SQLite) |
| **D7** | **Sessions lost on restart** — `express-session` uses `MemoryStore`; every restart logs out all users | `server/index.js:32–39` | UX friction; cannot scale | 1 hour |
| **D8** | **Dead components not imported** — `HealthCheckupPanel.jsx`, `CollisionRadarPanel.jsx`, `AuthButton.jsx` fully built but unused; logic re-implemented inline | `client/src/components/` | Code debt, confusion | 30 min cleanup |
| **D9** | **Committed build output & playbook data** — `client/dist/` (2.4 MB) and `server/playbooks/` with 13 real repos + `server/.cache/pulse-cache.json` checked in | `client/dist/`, `server/playbooks/`, `server/.cache/` | Bloated repo, privacy leak | 20 min |

### 1.3 Tier 0 Impact Summary

**Fixing all 9 defects = ~5 hours of focused work, but:**
- Makes the project **runnable out of the box** ✅
- Restores **security** (webhook signatures) ✅  
- Fixes **AI context** (chat will actually work) ✅
- **Doubles credibility** with stakeholders ✅

---

## 2. Feature Roadmap Assessment

### 2.1 Will These Features Help?

**YES, absolutely.** The three tiers represent a 10x differentiation:

| Tier | Feature | Impact | Why It Matters |
|------|---------|--------|-----------------|
| **1a** | **Merge Forecast** (ground-truth `merge-tree` + optimal ordering DAG) | Very High | Only respro can tell you *when* and *in what order* to merge. Competitors show you *after* it breaks. |
| **1b** | **Ask the Repo's History** (temporal RAG over playbook + embeddings) | Very High | GitHub Copilot sees code. respro sees *intent*. You can ask "why did we cache by SHA?" and get a cited commit trail. Defensible moat. |
| **1c** | **Knowledge Ledger** (join expertise + WIP + reviewer recommendation) | High | Automatically recommend the right reviewer and warn of knowledge loss when someone leaves. Genuinely novel. |
| **2a** | **GitHub Check Run** (comment on every PR, become infrastructure) | High | A check that comments on PRs is 100x stickier than a dashboard you visit once. This is distribution. |
| **2b** | **Time-travel replay** (scrub playbook backwards) | Medium | Best demo per line of code. Shows bus factor collapse, collision spike right before incidents. Instantly compelling. |
| **2c** | **Churn × Complexity quadrant** | Medium | Identifies the riskiest files. Pairs perfectly with ownership heatmap. |
| **3** | **Growth loops** (badges, "Repo Wrapped", contributor cards) | Low-Medium | Free marketing if the core features work. |

---

## 3. Implementation Roadmap (Sequenced)

### Phase 1: Credibility (Week 1) — Fix Tier 0 Defects

**Goal:** Make it production-ready.

| Task | Effort | Priority |
|------|--------|----------|
| Fix port mismatch (use shared `.env` variable) | 15 min | 🔴 P0 |
| Fix webhook signature verification (read secret in handler) | 30 min | 🔴 P0 |
| Fix chat schema mismatch (shared zod types) | 20 min | 🔴 P0 |
| Update README: clarify Ollama, remove Claude references | 10 min | 🔴 P0 |
| Remove unused dependencies | 5 min | 🔴 P0 |
| Clean up `.gitignore`: exclude `client/dist/`, `server/.cache/`, committed playbooks | 10 min | 🔴 P0 |
| Add file locking or migrate to SQLite (quick version: distributed lock via `.lock` file) | 2 hours | 🔴 P0 |
| Move sessions to persistent store (e.g., file-based or SQLite) | 1 hour | 🟠 P1 |
| Remove/comment dead components | 30 min | 🟠 P1 |

**Deliverable:** A fresh clone runs immediately; security verified; AI chat works; looks professional.

---

### Phase 2: Flagship Features (Weeks 2–3)

#### Week 2A: Merge Forecast (the highest-ROI Tier 1 feature)

**Effort:** 8–12 hours (medium-high)

1. **Add `cloneService.js`** — maintains a shallow bare clone at `server/.repos/{owner}-{repo}`, cheap GC cleanup
2. **Add `mergeSimulationService.js`** — wraps `git merge-tree --write-tree` to detect **ground-truth conflicts** (not just heuristic overlap)
3. **Extend `collisionService.js`** — for detail view, call merge simulation; add conflict hunks and rebase effort estimate
4. **PR comment posting** (optional, high-value) — auto-post to conflicted PRs: *"@alice and @bob are both editing auth.js:40–80…"*
5. **Merge ordering DAG** — build conflict graph across all open PRs, emit recommended sequence

**Deliverable:** When viewing a repo, see a DAG of PRs with real conflict predictions and merge order recommendations.

#### Week 2B: Ask the Repo's History (temporal RAG + embeddings)

**Effort:** 10–14 hours (medium-high)

1. **Add `embeddingService.js`** — vectorize playbook entries (`message`, `impact`, `keywords`, `area`) using Ollama's `nomic-embed-text`
2. **Brute-force or SQLite vector search** — retrieve top-K similar commits for a free-form question
3. **Extend `chatService.js` system prompt** — include retrieved commit history as *"here are similar past changes"*
4. **Auto-draft ADRs** — cluster playbook entries by area + semantic sim, have LLM generate Architecture Decision Records
5. **Drift alerts** — flag commits that violate area norms (e.g., *"This skips the cache; 14 prior commits route through it"*)

**Deliverable:** Ask *"Why do we cache by version SHA?"* and get a cited commit trail. Drift warnings on new PRs.

---

### Phase 3: Distribution & Leverage (Week 3+)

#### 3A: GitHub Check Run (moderate effort, high stickiness)

Add `POST /api/check/:owner/:repo` returning a check conclusion with markdown summary (health score, collisions, drift warnings, bus-factor delta). Pair with `npx respro check` CLI.

#### 3B: Time-Travel Replay (low effort, amazing demo)

A timeline scrubber in the UI that recomputes health, collisions, and ownership at any past point. Watch bus factor collapse, collisions spike before incidents.

#### 3C: Growth Loops (very low effort)

- Health badge + read-only share page
- "Repo Wrapped" annual narrative per contributor
- Contributor expertise cards (shareable)

---

## 4. Foundation Work (Unlocks Everything)

These are table-stakes for scaling beyond the MVP:

### 4.1 SQLite Migration

**Problem solved:**  
- Concurrent-write corruption (§D6) — use WAL mode  
- Persistent sessions (§D7) — session table  
- Indexed queries for time-travel, ownership decay, quadrants  
- Embedded vectors for temporal RAG  

**Effort:** 6–8 hours  
**ROI:** High — unblocks embedding features and scales reliably

### 4.2 Shared Schema Layer

Zod or TypeScript types shared between `server/` and `client/`. Prevents the `chatService` / `collisionService` bug from recurring.

**Effort:** 4–6 hours  
**ROI:** High — catch contract violations at dev time

### 4.3 Test Fixtures + Snapshot Tests

Fixture repos (JSON playbooks) for the collision parser, health formula, and board logic. Enables demoing without GitHub auth.

**Effort:** 4–6 hours  
**ROI:** Medium — improves reliability and demo speed

---

## 5. Files to Create / Modify

### Tier 0 (Critical Fixes)

| File | Action | Lines Changed | Purpose |
|------|--------|---------------|---------|
| `.env.example` | Create | N/A | Document all env vars incl. single `PORT` |
| `server/index.js` | Modify | ~5 | Read `PORT` from `.env` |
| `client/vite.config.js` | Modify | ~2 | Read `PORT` from `.env` (or use 3002 hardcoded after server uses 3002) |
| `server/routes/webhook.js` | Modify | ~10 | Read `WEBHOOK_SECRET` inside handler, fail closed |
| `server/routes/auth.js` | Modify | ~5 | Remove lazy `getWebhookSecret()` logic after webhook fix |
| `server/services/chatService.js` | Modify | ~20 | Fix schema: `status` → `isResolved`, `contributor1/2` → `authors[]`, etc. |
| `server/services/collisionService.js` | Modify | ~5 | Ensure exported shape matches fixed schema |
| `server/package.json` | Modify | ~5 | Remove `@anthropic-ai/sdk`, `node-cache` |
| `README.md` | Modify | ~30 | Replace "Anthropic Claude API" with "Ollama local inference", clarify privacy model |
| `.gitignore` | Modify | ~10 | Add `client/dist/`, `server/playbooks/`, `server/.cache/` |
| `shared/collisionSchema.ts` (NEW) | Create | ~40 | Zod schema for collision radar object (shared with client) |

**Estimated time:** ~3 hours total

### Tier 1 & Beyond (Roadmap Features)

| Feature | New Files | Modified Files | Effort |
|---------|-----------|-----------------|--------|
| Merge Forecast | `cloneService.js`, `mergeSimulationService.js` | `collisionService.js`, routes | 8–12 h |
| Ask the Repo | `embeddingService.js` | `chatService.js`, `collisionService.js` | 10–14 h |
| Knowledge Ledger | `reviewerService.js` | routes | 6–8 h |
| GitHub Check Run | `checkService.js` | new route `check.js` | 3–4 h |
| Time-Travel Replay | — (client-side) | client pages, existing route | 2–3 h |

---

## 6. File Analysis Summary

### Server Structure
- **Routes (7 files):** auth, pulse, playbook, board, collision, health, webhook
- **Services (13 files):** All business logic, tightly cohesive, some circular deps
- **Config:** Port mismatch, port 3002 in vite conflicts with server 3003

### Client Structure
- **Pages (6 files):** Landing, Overview, Insights, Activity, Collaboration, Tasks
- **Components (30 files):** Mixed presentational + container; 3 unused
- **Utils:** Single `api.js` file is the HTTP layer

### Issues Identified
- ✅ Tech stack is solid (React 18, Vite 5, Express 4, TailwindCSS 3.4)
- ⚠️ Security: Webhook verification disabled (D2)
- ⚠️ Data integrity: Concurrent writes not protected (D6)
- ⚠️ Integration: Schema mismatch between services (D3)
- ⚠️ Documentation: README is misleading (D4)
- ⚠️ Deployment: Port configuration is fragile (D1)

---

## 7. Recommended Action Plan

### Immediate (This Week)
1. **Fix Tier 0 defects** (3–4 hours)
   - [ ] Resolve port mismatch
   - [ ] Fix webhook verification
   - [ ] Fix chat schema
   - [ ] Update README & clean .gitignore

2. **Add `.env.example`** and document setup
   - [ ] Include all env vars: `PORT`, `GITHUB_CLIENT_ID`, `OLLAMA_BASE_URL`, etc.

### Short-term (Next 2 Weeks)
3. **Migrate to SQLite** (6–8 hours)
   - [ ] Replace JSON files with WAL-mode SQLite
   - [ ] Move sessions to DB
   - [ ] Add indexed queries

4. **Implement Merge Forecast** (8–12 hours) — the flagship feature
   - [ ] Add `cloneService.js` + `mergeSimulationService.js`
   - [ ] Integrate conflict prediction into collision detail view
   - [ ] PR comment posting (optional)

### Medium-term (Weeks 3–4)
5. **Temporal RAG over Playbook** (10–14 hours)
   - [ ] Add embedding service
   - [ ] Enhance chat with semantic history retrieval
   - [ ] Auto-generate ADRs

6. **GitHub Check Run** (3–4 hours) — distribution vector
   - [ ] CLI for `npx respro check`

### Polish (Ongoing)
7. **Growth loops:** badges, Repo Wrapped, contributor cards

---

## 8. Success Criteria

✅ **Tier 0 Complete When:**
- Fresh clone runs with `npm install && npm run dev` (both client & server) without port conflicts
- Webhook signatures are verified
- Chat returns non-empty collision context
- README accurately describes the tech stack
- `.gitignore` excludes build output and data files

✅ **Roadmap Features Prove Value When:**
- Merge Forecast catches a real conflict *before* a developer tries to merge
- Ask-the-Repo answers a domain-specific question with cited commits
- GitHub Check Run gets pinned as a branch protection rule
- Time-travel demo visibly shows a past incident's collision spike

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SQLite migration breaks existing playbooks | Export/import JSON; run migration in reverse |
| Merge-tree adds latency | Cache results per PR; async compute |
| Embeddings OOM on large repos | Pagination; SQLite vector search (sqlite-vec) |
| Webhook verification breaks existing hooks | Keep a grace period flag; log old vs. new |

---

## Conclusion

**respro is a genuinely innovative project.** The Playbook, Collision Radar, and local-first privacy model are real differentiators. The roadmap features (Merge Forecast, Temporal RAG, Knowledge Ledger) will make it defensibly better than any competitor.

**However, the project currently has show-stopping defects** (port mismatch, disabled webhook verification, broken AI context) that must be fixed first. Once those ~5 hours are complete, the Tier 1 features are clear wins.

**Recommended sequence:**
1. **This week:** Tier 0 fixes + `.env` setup
2. **Next 2 weeks:** SQLite + Merge Forecast (the biggest ROI)
3. **Week 3+:** Temporal RAG + GitHub Check Run (depth + distribution)

This roadmap will take you from "interesting but rough" to "production-grade and genuinely rare."

---

**Next Steps:**
- ✅ Review this analysis for accuracy
- ✅ Prioritize which Tier 0 fixes to tackle first
- ✅ Decide: SQLite migration before or after Merge Forecast?
- ✅ Open GitHub issues for each task (link to this doc)
