# GitSage

**The brain behind your branches** - A GitHub repository health dashboard with AI-powered insights, collision detection, and task management.

## Features

### Core Analytics
- **Repository Health Overview**: Comprehensive health scores across 6+ categories (documentation, testing, security, etc.)
- **Activity Heatmap**: Visualize commit activity patterns over time
- **Branch Analysis**: Track all branches with stale branch detection
- **Pull Request Tracking**: Monitor open PRs and their status
- **Issue Overview**: Track open issues with labels and priorities
- **Contributor Activity**: See who's been active and their contributions

### AI-Powered Features
- **Intelligent Health Summaries**: AI-generated repository health analysis
- **Commit Analysis (Playbook)**: Every commit gets an AI-powered before/after/impact summary
- **Chat Assistant**: Ask GitSage AI questions about your repository
- **Blocker Detection**: Automatic detection of development blockers

### Collaboration Tools
- **Collision Detection**: Identify overlapping work between team members before merge conflicts happen
- **Contributor Heatmaps**: Visualize who's working on what parts of the codebase
- **Work Overlap Warnings**: Get alerts when multiple contributors modify the same files

### Task Management
- **Kanban Board**: Jira-style task board with drag-and-drop
- **Deadline Tracking**: Visual warnings for approaching and overdue tasks
- **Contributor Flags**: Track missed deadlines per contributor
- **PR Integration**: Auto-move tasks when linked PRs are merged
- **Self-Assign Only**: Tasks can only be self-assigned for accountability

## Tech Stack

- **Frontend**: React + Vite, Tailwind CSS, React Query, @dnd-kit, Recharts
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude API
- **Data Source**: GitHub REST API
- **Real-time**: Server-Sent Events (SSE)
- **Caching**: In-memory cache with configurable TTL

## Project Structure

```
gitsage/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # UI components (KanbanBoard, TaskCard, etc.)
│   │   ├── pages/           # Page-level views
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Helper functions & API
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js
├── server/                  # Node.js + Express backend
│   ├── routes/              # API route handlers
│   │   ├── pulse.js         # Repository data
│   │   ├── auth.js          # GitHub OAuth
│   │   ├── board.js         # Kanban board API
│   │   └── webhook.js       # GitHub webhooks
│   ├── services/            # Business logic
│   │   ├── githubService.js
│   │   ├── chatService.js
│   │   ├── boardService.js
│   │   └── collisionService.js
│   └── index.js             # Entry point
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- GitHub Personal Access Token (optional, but recommended for higher rate limits)
- Anthropic API Key (for AI features)

### Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd gitsage
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd ../client
   npm install
   ```

4. Set up environment variables:
   ```bash
   cd ../server
   cp ../.env.example .env
   # Edit .env with your tokens
   ```

### Running the Application

1. Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

2. In a new terminal, start the frontend:
   ```bash
   cd client
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pulse` | Fetch repository health data |
| POST | `/api/chat` | Chat with AI about the repo |
| GET | `/api/health` | Health check endpoint |
| GET | `/api/health/:owner/:repo` | Repository health checkup |
| GET | `/api/collisions/:owner/:repo` | Collision detection report |
| GET | `/api/board/:owner/:repo` | Get Kanban board |
| POST | `/api/board/:owner/:repo/tasks` | Create task |
| PATCH | `/api/board/:owner/:repo/tasks/:id` | Update task |
| PATCH | `/api/board/:owner/:repo/tasks/:id/move` | Move task between columns |
| DELETE | `/api/board/:owner/:repo/tasks/:id` | Delete task |
| GET | `/api/playbook/:owner/:repo` | Get AI-analyzed commit history |
| POST | `/api/commit/analyze` | Analyze a specific commit |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Recommended |
| `ANTHROPIC_API_KEY` | Anthropic API Key | For AI features |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | For auth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret | For auth |
| `GITHUB_WEBHOOK_SECRET` | Webhook verification secret | For webhooks |
| `SESSION_SECRET` | Session encryption secret | Recommended |
| `PORT` | Server port (default: 3001) | No |
| `CLIENT_URL` | Client URL for CORS (default: http://localhost:5173) | No |

## GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to `http://localhost:3001/api/auth/github/callback`
4. Copy Client ID and Client Secret to your `.env` file

## Deployment

The project is structured for independent deployment:

- **Frontend**: Deploy to Vercel, Netlify, or any static hosting
- **Backend**: Deploy to Railway, Render, Heroku, or any Node.js hosting

### Frontend Deployment (Vercel)

1. Connect your repository to Vercel
2. Set the root directory to `client`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable: `VITE_API_URL` pointing to your backend URL

### Backend Deployment (Railway)

1. Connect your repository to Railway
2. Set the root directory to `server`
3. Add environment variables from `.env.example`

## License

MIT
