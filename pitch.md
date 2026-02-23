# GitSage - Pitch Deck

> **"The Brain Behind Your Branches"**

---

## The Problem

Engineering teams today are **flying blind**. They ship code every day but lack real-time, intelligent visibility into what's actually happening across their repositories.

### What's broken right now:

1. **No one knows the real health of a project until it's too late.**
   GitHub Insights gives you vanity metrics -- commit counts and contributor graphs. It tells you *what happened*, never *what it means*. By the time a team lead notices velocity has dropped or a critical module has a single point of failure, the damage is already done.

2. **Developers unknowingly step on each other's code.**
   Two engineers modifying the same functions in overlapping time windows is one of the most common and costly sources of merge conflicts, regressions, and wasted hours. No mainstream tool detects this *before* the merge conflict appears.

3. **Commit history is a graveyard of context.**
   What was the codebase like *before* a change? What did a commit actually *add*? What's the downstream *impact*? These answers are buried in raw diffs that nobody reads after day one. Institutional knowledge walks out the door every time someone leaves the team.

4. **Project management and code reality live in separate worlds.**
   Jira boards, Linear tickets, and GitHub issues are disconnected from actual code activity. Tasks don't auto-update when PRs land. Deadlines slip silently. Blockers hide in plain sight.

5. **Health assessments are subjective.**
   "How's the project going?" is answered with gut feelings, not data. There is no standardized, automated scoring system that evaluates collaboration quality, velocity trends, and bus factor risk with letter grades and actionable recommendations.

### The existing landscape falls short:

| Tool | What It Does | What It Misses |
|------|-------------|----------------|
| **GitHub Insights** | Basic commit/contributor graphs | No AI analysis, no collision detection, no health scoring |
| **GitPrime / Pluralsight Flow** | Developer productivity metrics | No AI commit understanding, no collision detection, no task management |
| **LinearB** | Cycle time and workflow metrics | No function-level collision detection, no AI playbook, no real-time SSE |
| **CodeClimate** | Code quality / test coverage | Zero focus on team dynamics, collisions, or project health |
| **Sleuth / Jellyfish** | DORA metrics | No commit-level AI analysis, no Kanban, no collision radar |

**No single tool combines AI-powered code intelligence, real-time collision detection, automated health scoring, and integrated task management.** That's the gap. That's our opportunity.

---

## The Solution: GitSage

GitSage is an **AI-powered repository intelligence platform** that gives engineering teams a living, breathing understanding of their codebase -- not just what changed, but *why it matters*.

Connect a GitHub repo. In seconds, GitSage pulls commits, branches, PRs, issues, and contributors -- then layers on AI analysis, collision detection, health scoring, and smart task management to give teams complete situational awareness.

---

## Core Capabilities

### 1. AI Health Pulse -- Instant Project Diagnostics

GitSage generates an AI-powered health summary the moment you connect a repo:

- **Health Rating**: Healthy / At Risk / Critical -- at a glance
- **Smart Headline**: A one-sentence diagnosis of project state
- **Highlights**: What's going well (recent activity, active contributors, clean PR flow)
- **Concerns**: Early warning signals (stale branches, declining velocity, unreviewed PRs)
- **Blockers**: Actionable blockers with severity (stale PRs, long-running PRs, unassigned old issues)
- **Recommendations**: Specific next steps to improve project health

This isn't a dashboard you check weekly. It's a **living diagnostic** that updates every time new commits land, delivered via Server-Sent Events in real time.

### 2. Collision Radar -- Catch Conflicts Before They Happen

This is our **strongest differentiator**. GitSage performs three levels of overlap detection across a configurable time window (default: 3 days):

| Level | What It Detects | How |
|-------|----------------|-----|
| **Line-Range Overlap** | Two developers editing overlapping line ranges in the same file | Git hunk header parsing (`@@ -a,b +c,d @@`) |
| **Function-Level Overlap** | Two developers modifying the same function or method | Multi-language regex extraction (JS, TS, Python, Java, Kotlin, C#, Go, Ruby) |
| **File-Level Overlap** | Two developers touching the same file in the same window | File path matching across commits |

Each collision is scored by risk level, tracks which developers are involved, and supports **resolution tracking** -- teams can mark collisions as resolved and track who resolved them and when.

**Why this matters**: Merge conflicts are the #2 developer productivity killer (after unclear requirements). GitSage surfaces them *before* they happen, saving hours of conflict resolution and preventing regressions.

### 3. Project Playbook -- Institutional Memory That Never Leaves

Every commit that enters the repository gets an AI-generated summary with three components:

- **Before**: What was the state of the code before this change?
- **Added**: What specifically was introduced or modified?
- **Impact**: What are the downstream effects of this change?

These summaries are persisted to disk as structured JSON playbooks -- one per project, plus per-contributor breakdowns. The playbook:

- **Survives team turnover**: New engineers can read the playbook to understand months of project history in minutes
- **Feeds the AI chat**: When you ask GitSage questions, it has the full playbook as context
- **Batch initializes**: First connection processes up to 20 historical commits to bootstrap the knowledge base
- **Background analysis**: A queue-based background service continuously processes unanalyzed commits (max 2 concurrent repos, 2s delay between commits to avoid rate limits)

### 4. Deep Commit Analysis -- X-Ray Vision for Every Change

Go beyond `git log`. GitSage's commit analyzer:

- Fetches the full diff for any commit
- Intelligently filters out noise (lock files, images, build artifacts, binaries)
- Chunks large diffs for AI processing, then merges results
- Produces a structured analysis: **headline, type classification** (feature / bugfix / refactor / config / docs / test / chore), **impact level** (high / medium / low), **per-file change descriptions**, and a **key insight**

This turns every commit from an opaque SHA into a searchable, understandable knowledge artifact.

### 5. AI Chat Assistant -- Talk to Your Repository

A streaming conversational AI that has full context of:

- Repository metadata (stars, forks, languages, open issues/PRs)
- The entire project playbook
- Active collisions
- Current branch and contributor state

Ask it anything: *"What were the major changes last week?"*, *"Who's been working on the auth module?"*, *"Are there any risky overlaps right now?"*. Responses stream in real time with markdown formatting.

### 6. Health Checkup -- Letter-Graded Project Scoring

A comprehensive health evaluation across three weighted dimensions:

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| **Code Collaboration** | 35% | PR review rates, contributor distribution, review turnaround |
| **Project Velocity** | 40% | Commit frequency, PR merge rate, issue close rate, trend direction |
| **Bus Factor** | 25% | Contributor concentration risk, knowledge distribution |

Each dimension receives a letter grade (A+ through F) with specific scores, and the weighted overall grade comes with tailored recommendations. This gives engineering managers an **objective, repeatable, comparable** measure of project health.

### 7. Smart Kanban Board -- Tasks That Move Themselves

A built-in task board with four columns (To Do, In Progress, In Review, Done) that:

- Supports **drag-and-drop** reordering via @dnd-kit
- Assigns **priority levels**: Critical, High, Medium, Low
- Tracks **deadlines** with automatic overdue flagging and approaching-deadline warnings (2-day threshold)
- **Auto-moves tasks** when linked PRs are merged (via GitHub webhooks)
- Enforces **self-assign only** -- contributors can only assign tasks to themselves
- Tracks **contributor deadline flags** for accountability

### 8. Real-Time Everything -- SSE + Webhooks + Polling

GitSage is not a static dashboard. It's a **live system**:

- **Server-Sent Events (SSE)**: Client subscribes per-repo; receives live updates for new commits, analysis completions, collision changes
- **GitHub Webhooks**: Automatically created on OAuth; processes push, pull_request, and create events in real time
- **Background Polling**: Configurable interval (default 30s) catches anything webhooks miss
- **Live Toast Notifications**: New events appear as non-intrusive toasts in the UI

---

## Technical Architecture

```
+------------------+          +-------------------+          +----------------+
|                  |   SSE    |                   |  REST    |                |
|   React Client   |<---------|   Express Server  |--------->|   GitHub API   |
|   (Vite + TW)   |--------->|   (Node.js 18+)   |          |   (REST v3)    |
|                  |   REST   |                   |          +----------------+
+------------------+          +-------------------+
                                    |        |
                              +-----+        +------+
                              |                     |
                        +-----------+         +------------+
                        | Ollama AI |         | Disk Cache |
                        | (Local)   |         | (JSON)     |
                        +-----------+         +------------+
```

### Key architectural decisions:

- **Local AI via Ollama**: No data leaves your infrastructure. All AI processing happens locally through Ollama, making GitSage suitable for enterprises with strict data sovereignty requirements. No OpenAI API keys, no cloud AI dependencies, no per-token costs.
- **Version-based caching**: Cache invalidation is tied to the latest commit SHA, not arbitrary TTLs. When a new commit lands, the cache invalidates. When nothing changes, responses are instant from disk.
- **Persistent playbooks**: Project knowledge is stored as structured JSON on disk, not in a database. This makes backup, migration, and inspection trivial.
- **Modular service architecture**: 13 focused services, each with a single responsibility, making the system easy to extend and maintain.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, TailwindCSS 3.4, Recharts, @dnd-kit, React Query |
| **Backend** | Node.js 18+, Express 4.18, ES Modules |
| **AI Engine** | Ollama (local), configurable model (default: kimi-k2.5) |
| **Data Source** | GitHub REST API v3 |
| **Auth** | GitHub OAuth with express-session |
| **Real-time** | Server-Sent Events, GitHub Webhooks |
| **Storage** | Disk-based JSON (cache + playbooks) |
| **Design** | Custom design system with glassmorphism, Inter + JetBrains Mono fonts |

---

## Key Strengths

### 1. No Tool Does What We Do
GitSage is the **only platform** that combines AI commit intelligence + collision detection + health scoring + task management in one unified interface. Competitors focus on one slice; we deliver the full picture.

### 2. Privacy-First AI
All AI processing runs locally through Ollama. Your code never leaves your infrastructure. This is a dealbreaker advantage for enterprises, government contractors, and any team handling sensitive codebases.

### 3. Function-Level Collision Detection
No other tool parses git diffs and extracts function signatures across 8 languages to detect overlapping work at the function level. This is novel and immediately valuable.

### 4. Zero Database Dependency
No Postgres, no MongoDB, no Redis. GitSage uses disk-based JSON with version-aware caching. This means near-zero setup friction, easy backup, and trivial deployment.

### 5. Institutional Memory as a Feature
The playbook system turns commit history from a write-only log into a searchable, AI-enriched knowledge base that persists across team changes.

### 6. Real-Time by Default
SSE + Webhooks + Polling ensures the dashboard is always current. No manual refresh, no stale data.

### 7. Objective Health Scoring
Letter grades across Code Collaboration, Project Velocity, and Bus Factor replace subjective status updates with data-driven assessments that are comparable across projects and time periods.

---

## Market Opportunity

- **$15B+ Developer Tools market** (growing 20%+ YoY)
- **28M+ developers** on GitHub
- **100M+ repositories** on GitHub
- Engineering leaders spend an average of **5-8 hours/week** gathering project status manually
- Merge conflicts cost an average team **2-4 hours/week** in lost productivity
- Knowledge loss from team turnover costs companies an estimated **$50K-150K per departed engineer**

---

## Target Users

| Segment | Pain Point We Solve |
|---------|-------------------|
| **Engineering Managers** | "How's the project *really* going?" -- Objective health scores and AI summaries replace gut feelings |
| **Tech Leads** | "Who's stepping on whose code?" -- Collision radar prevents merge conflicts before they happen |
| **Individual Developers** | "What did this commit actually do?" -- AI commit analysis provides instant context |
| **New Team Members** | "What's been happening in this codebase?" -- Playbook provides months of context in minutes |
| **CTOs / VPs of Engineering** | "How do our projects compare?" -- Standardized letter-graded health scores across all repos |

---

## Competitive Advantage Summary

```
                    AI Commit    Collision    Health     Kanban    Local    Real-
                    Analysis     Detection    Scoring    Board     AI       Time
GitSage               Y            Y            Y         Y        Y        Y
GitHub Insights       -            -            -         -        -        -
GitPrime/Flow         -            -            ~         -        -        -
LinearB               -            -            ~         -        -        ~
CodeClimate           -            -            ~         -        -        -
Sleuth                -            -            ~         -        -        ~
```

**GitSage is the only platform that checks every box.**

---

## Product Vision & Roadmap

### Now (v1 -- Shipped)
- AI health pulse with real-time updates
- 3-level collision detection (line, function, file) across 8 languages
- Project playbook with batch initialization and background analysis
- Deep commit analyzer with diff chunking
- Streaming AI chat with full repo context
- Letter-graded health checkup
- Smart Kanban with auto-move and deadline tracking
- GitHub OAuth + Webhook integration
- SSE-based real-time updates

### Next (v2)
- Multi-repo dashboards -- compare health scores across an entire organization
- Slack/Teams integration -- collision alerts and health updates in your communication tools
- Custom AI models -- bring your own model or use cloud providers
- Historical trend analysis -- health score tracking over weeks and months
- PR risk scoring -- AI-predicted merge conflict probability before you click "Create PR"

### Future (v3)
- IDE extensions (VS Code, JetBrains) -- collision warnings while you code
- Automated code review suggestions powered by playbook context
- Cross-repo collision detection for monorepo and multi-repo architectures
- Team performance benchmarks with anonymized industry comparisons
- API platform -- let other tools consume GitSage intelligence

---

## Why Now?

1. **Local AI is finally viable.** Ollama and open-source models have reached the quality threshold where local inference produces production-grade analysis. This wasn't possible 18 months ago.

2. **Teams are more distributed than ever.** Remote work has made "tap someone on the shoulder" impossible. Collision detection and async context are no longer nice-to-have -- they're essential.

3. **AI fatigue is setting in for generic tools.** Developers are tired of ChatGPT wrappers. They want AI that's deeply integrated into their workflow with real context, not generic copilots that hallucinate about their codebase.

4. **The developer tools market is consolidating.** Teams want fewer tools, not more. A unified platform that replaces 3-4 point solutions has a massive adoption advantage.

---

## The Ask

GitSage is built, working, and ready to scale. We're looking for:

- **Early adopter teams** willing to deploy GitSage on their repositories and provide feedback
- **Design partners** in enterprise environments to validate the privacy-first local AI model
- **Investment** to accelerate the v2 roadmap (multi-repo, integrations, historical trends)

---

## One-Liner

**GitSage gives engineering teams AI-powered X-ray vision into their repositories -- catching code collisions before they happen, turning commit history into institutional memory, and replacing gut-feeling status updates with letter-graded health scores -- all with an AI that never sees your code leave your infrastructure.**

---

*GitSage -- The Brain Behind Your Branches.*
