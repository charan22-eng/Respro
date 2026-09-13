# Tier 0 Defect Fixes — Implementation Guide

**Estimated Total Time:** 3–4 hours  
**Difficulty:** Easy to Medium  
**Impact:** Critical — makes project runnable and secure

---

## Quick Checklist

- [ ] Fix 1: Port mismatch (15 min)
- [ ] Fix 2: Webhook signature verification (30 min)
- [ ] Fix 3: Chat schema mismatch (20 min)
- [ ] Fix 4: Update README (10 min)
- [ ] Fix 5: Remove dead dependencies (5 min)
- [ ] Fix 6: Update .gitignore (10 min)
- [ ] Fix 7: Add .env.example (10 min)
- [ ] Fix 8: Test everything (30 min)

---

## FIX 1: Port Mismatch (15 min)

**Problem:** Server runs on 3003, Vite proxies to 3002, README says 3001 → fresh clone fails immediately.

### Step 1.1: Create `.env.example`

```bash
# Environment variables for respro development

# Server
PORT=3002
NODE_ENV=development
SESSION_SECRET=respro-session-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# AI & Services
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=kimi-k2.5:cloud
OLLAMA_CHAT_MODEL=kimi-k2.5:cloud

# Client
VITE_API_PORT=3002
```

### Step 1.2: Modify `server/index.js`

Change line 17 from:
```js
const PORT = process.env.PORT || 3003;
```

To:
```js
const PORT = process.env.PORT || 3002;
```

### Step 1.3: Verify `client/vite.config.js`

Confirm the proxy target matches (should already be 3002):
```js
proxy: {
  '/api': {
    target: 'http://localhost:3002',  // ✅ Correct
    changeOrigin: true
  }
}
```

### Step 1.4: Update `README.md`

Find the section "Getting Started" and update port references:
- Change "3001" to "3002" (or whatever port you choose)
- Change "3003" to "3002"
- Add a line: *"Both client and server default to port 3002. To use a different port, set `PORT=<number>` before running."*

**Verification:**
```bash
# Terminal 1: Start server
cd server && npm run dev
# Should see: "respro server running on http://localhost:3002"

# Terminal 2: Start client
cd client && npm run dev
# Should see: "VITE v5.x.x ready in xxx ms"
# Client at http://localhost:5173, proxying /api to :3002
```

---

## FIX 2: Webhook Signature Verification (30 min)

**Problem:** `server/routes/webhook.js` captures `WEBHOOK_SECRET` at module load, but `server/routes/auth.js` sets it lazily during OAuth → verification always skipped. **Security risk.**

### Step 2.1: Fix `server/routes/webhook.js`

**Find** (around line 16–30):
```js
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) return true; // Skip verification if no secret configured
  if (!signature) return false;
  // ...
}
```

**Replace with:**
```js
/**
 * Verify GitHub webhook signature
 * Reads the secret from env at request time (not module load)
 */
function verifySignature(payload, signature) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  
  // Fail closed: if no secret configured, REJECT (don't skip)
  if (!webhookSecret) {
    console.warn('⚠️ WEBHOOK_SECRET not configured — rejecting webhook request');
    return false;
  }
  
  if (!signature) {
    console.warn('⚠️ No X-Hub-Signature-256 header in webhook request');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}
```

### Step 2.2: Update webhook POST handler

**Find** (around line 130–140):
```js
app.post('/:owner/:repo', (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody; // Depends on body-parser config
  
  if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  res.status(200).json({ received: true });
  // ...
});
```

**Update line 5** to:
```js
  if (!verifySignature(rawBody, signature)) {  // Always verify now (no WEBHOOK_SECRET check)
    return res.status(401).json({ error: 'Invalid signature' });
  }
```

### Step 2.3: Ensure `express.json()` middleware captures raw body

In `server/index.js`, you need to capture the raw body before JSON parsing. Update the `express.json()` middleware:

**Find** (around line 25):
```js
app.use(express.json({ limit: '2mb' }));
```

**Replace with:**
```js
// Capture raw body for webhook signature verification
app.use((req, res, next) => {
  let rawBody = '';
  req.on('data', (chunk) => {
    rawBody += chunk.toString();
  });
  req.on('end', () => {
    req.rawBody = rawBody;
    next();
  });
});

app.use(express.json({ limit: '2mb' }));
```

**Verification:**
```bash
# Test with a missing secret
unset GITHUB_WEBHOOK_SECRET
curl -X POST http://localhost:3002/api/webhook/owner/repo \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -d '{"action": "push"}'
# Should return: 401 Unauthorized

# Test with correct secret
export GITHUB_WEBHOOK_SECRET=test-secret
# (Manually compute the correct signature for your payload and test)
```

---

## FIX 3: Chat Schema Mismatch (20 min)

**Problem:** `chatService.js` reads collision data with field names that don't exist; the producer (`collisionService.js`) uses different names.

### Step 3.1: Check the schema mismatch

**In `server/services/chatService.js`** (around line 80–100), find lines that read collision context:
```js
// Wrong field names:
collisions.map(c => `${c.status === 'active' ? '⚠️' : '✅'} ${c.contributor1} vs ${c.contributor2}`)
// and:
c.contributors  // doesn't exist
```

**What `collisionService.js` actually emits:**
- `isResolved` (not `status`)
- `authors[]` (not `contributor1`, `contributor2`)
- `area` (not `file`)

### Step 3.2: Create shared schema file

Create `server/shared/schemas.js`:

```js
/**
 * Shared TypeScript/Zod schemas for type safety
 * This ensures collision, health, and board shapes match across all services
 */

export const CollisionSchema = {
  // Full collision object as emitted by collisionService.detectFileCollisions()
  full: {
    id: 'string (auto-generated, stable)',
    file: 'string (filepath)',
    authors: 'string[] (GitHub usernames)',
    type: '"line_overlap" | "function_overlap" | "file_only"',
    severity: '"high" | "medium" | "low"',
    isResolved: 'boolean',
    resolvedBy: 'string | null (GitHub username)',
    resolvedAt: 'ISO timestamp | null',
    lineRanges: '[{author: string, start: number, end: number}]',
    suggestion: 'string (human advice)',
  },
  
  // Summary for dashboard tiles
  summary: {
    totalCollisions: 'number',
    activeCollisions: 'number (where !isResolved)',
    timeWindowDays: 3,
    topFiles: '[{file: string, count: number}]',
  }
};

// Export for usage:
export function formatCollisionForChat(collision) {
  return `
📍 **${collision.file}**
Authors: ${collision.authors.join(', ')}
Type: ${collision.type} | Severity: ${collision.severity}
${collision.isResolved ? '✅ Resolved' : '⚠️ Active'}
Suggestion: ${collision.suggestion}
  `.trim();
}
```

### Step 3.3: Update `chatService.js`

**Find** the collision context-building section (around line 80–120) and replace with:

```js
// Build collision context using correct schema
let collisionContext = '';
if (repoContext.collisions && repoContext.collisions.activeCollisions > 0) {
  const active = repoContext.collisions.filter(c => !c.isResolved);
  collisionContext = `\n\n## COLLISION RADAR\n${
    active.map(c => `
📍 **${c.file}**
Authors: ${c.authors.join(', ')}
Type: ${c.type} | Severity: ${c.severity}
Suggestion: ${c.suggestion}
    `).join('\n')
  }`;
}
```

### Step 3.4: Import and use the shared schema

At the top of `chatService.js`:
```js
import { formatCollisionForChat } from '../shared/schemas.js';
```

**Verification:**
Test the chat endpoint:
```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What collisions exist?"}], "repoContext": {...}}'
# Should now return context with correct field names
```

---

## FIX 4: Update README (10 min)

**Problem:** README claims "Anthropic Claude API" but the code uses Ollama exclusively.

### Step 4.1: Find and replace sections

**In `README.md`, find:**
```markdown
## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS, React Query, @dnd-kit, Recharts
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude API          <-- WRONG
- **Data Source**: GitHub REST API
```

**Replace with:**
```markdown
## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS, React Query, @dnd-kit, Recharts
- **Backend**: Node.js + Express
- **AI**: Ollama (local inference) — *Your code never leaves your machine*
- **Data Source**: GitHub REST API
- **Real-time**: Server-Sent Events (SSE)
```

### Step 4.2: Add privacy section

Add a new section after "Features":

```markdown
## Privacy & Local-First

respro runs **entirely on your hardware**. All AI inference is powered by Ollama running locally on your machine:
- 🔒 No code, diffs, or commits are sent to external servers
- 🖥️ Choose your model: `kimi-k2.5:cloud`, `neural-chat`, `mistral`, or any Ollama-compatible model
- ⚡ Fast analysis: no network latency, no cloud API rate limits
```

### Step 4.3: Update Prerequisites section

**Find:**
```markdown
### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token (optional, but recommended for higher rate limits)
- Anthropic API Key (for AI features)    <-- REMOVE
```

**Replace with:**
```markdown
### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token (optional, but recommended for higher rate limits)
- Ollama running locally (download from https://ollama.ai)
  - Default model: `kimi-k2.5:cloud` (run `ollama pull kimi-k2.5:cloud`)
  - Can be changed via `OLLAMA_MODEL` env var
```

---

## FIX 5: Remove Dead Dependencies (5 min)

### Step 5.1: Update `server/package.json`

**Find:**
```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.24.0",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "express-session": "^1.19.0",
  "node-cache": "^5.1.2"
}
```

**Replace with:**
```json
"dependencies": {
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "express": "^4.18.2",
  "express-session": "^1.19.0"
}
```

### Step 5.2: Clean npm cache

```bash
cd server
npm install
npm prune  # Removes unreferenced packages
```

---

## FIX 6: Update .gitignore (10 min)

### Step 6.1: Review current `.gitignore`

Find the file and add:

```
# Build outputs
client/dist/
server/.cache/

# Playbooks (real repo data)
server/playbooks/

# Environment variables
.env
.env.local

# Node modules (already ignored, confirm)
node_modules/
```

### Step 6.2: Remove committed files

If already checked in, remove from git:

```bash
# Don't delete locally, just stop tracking
git rm --cached client/dist -r
git rm --cached server/.cache -r
git rm --cached server/playbooks -r

git commit -m "chore: stop tracking build output and cached data"
```

---

## FIX 7: Add `.env.example` (10 min)

**Already created in FIX 1.1**, but commit it:

```bash
git add .env.example
git commit -m "docs: add .env.example with all required variables"
```

---

## FIX 8: Test Everything (30 min)

### 8.1: Fresh Clone Test

```bash
# Simulate a fresh clone
mkdir /tmp/respro-test
cd /tmp/respro-test
git clone <your-repo>
cd respro

# Copy .env.example to .env
cp .env.example .env
# Edit .env with your GitHub credentials

# Install and run
cd server && npm install && npm run dev &
cd ../client && npm install && npm run dev &

# Should see:
# Client: "VITE v5.x.x ready in xxx ms" + "Local: http://localhost:5173"
# Server: "respro server running on http://localhost:3002"
```

### 8.2: Webhook Test

```bash
# 1. Generate a webhook secret
export GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 16)

# 2. Try to send a webhook WITHOUT signature
curl -X POST http://localhost:3002/api/webhook/owner/repo \
  -H "Content-Type: application/json" \
  -d '{"action": "push", "commits": []}'
# Should return: 401 Unauthorized

# 3. Compute correct signature
payload='{"action": "push", "commits": []}'
signature="sha256=$(echo -n "$payload" | openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" -hex | cut -d' ' -f2)"

# 4. Send WITH correct signature
curl -X POST http://localhost:3002/api/webhook/owner/repo \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $signature" \
  -d "$payload"
# Should return: 200 OK
```

### 8.3: Chat Test

```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What are the main collisions?"}],
    "repoContext": {
      "meta": {"owner": "test", "repo": "test"},
      "collisions": [
        {"file": "auth.js", "authors": ["alice", "bob"], "type": "line_overlap", "severity": "high", "isResolved": false, "suggestion": "Sync before merging"}
      ]
    }
  }'
# Should return: streaming JSON with collision context properly formatted
```

### 8.4: Dependency Check

```bash
cd server
npm list
# Should NOT show @anthropic-ai/sdk or node-cache
```

---

## Checklist: Before Committing

- [ ] Port is consistently 3002 in `server/index.js`, `client/vite.config.js`, `README.md`
- [ ] `.env.example` created with all variables
- [ ] `WEBHOOK_SECRET` read inside handler (not module load)
- [ ] `verifySignature()` fails closed (rejects when secret missing)
- [ ] `chatService.js` uses correct collision field names (`authors[]`, `isResolved`)
- [ ] README updated (no mentions of Claude, clear Ollama reference)
- [ ] `.gitignore` updated to exclude `client/dist/`, `server/.cache/`, `server/playbooks/`
- [ ] Dead dependencies removed from `package.json`
- [ ] Fresh clone test passes (no port conflicts, webhooks verify, chat works)
- [ ] All changes committed with clear messages

---

## Estimated Time Summary

| Fix | Time | Priority |
|-----|------|----------|
| Fix 1: Port mismatch | 15 min | 🔴 P0 |
| Fix 2: Webhook verification | 30 min | 🔴 P0 |
| Fix 3: Chat schema | 20 min | 🔴 P0 |
| Fix 4: Update README | 10 min | 🔴 P0 |
| Fix 5: Remove deps | 5 min | 🔴 P0 |
| Fix 6: .gitignore | 10 min | 🔴 P0 |
| Fix 7: .env.example | 10 min | 🟠 P1 |
| Fix 8: Test everything | 30 min | 🟠 P1 |
| **TOTAL** | **~2.5 hours** | — |

Once these are complete, your project will be:
✅ Runnable from a fresh clone  
✅ Secure (webhook verification works)  
✅ Functional (chat receives correct context)  
✅ Professional (accurate README, clean repo)  

Then you're ready for Tier 1 features! 🚀
