# Autonomous Agent with Mom

**Goal**: Run autonomous coding tasks on Hetzner server, interact via Slack from anywhere.

---

## Overview

Use `mom` (Master Of Mischief) from pi-mono as the autonomous agent runner. Mom is a Slack bot powered by pi that:

- Runs autonomously on a server
- Asks questions via Slack when needed
- Self-manages (installs tools, creates skills)
- Persists state across sessions
- Runs in Docker sandbox for safety

```
┌─────────────────────────────────────────────────────┐
│ Hetzner Server (EX63)                               │
│                                                     │
│  ┌─────────────────┐     ┌────────────────────┐    │
│  │  mom (Node.js)  │────▶│ Docker Sandbox     │    │
│  │                 │     │  - bash access     │    │
│  │  Slack Socket   │     │  - file I/O        │    │
│  │  Mode           │     │  - git, bun, etc.  │    │
│  └────────┬────────┘     └────────────────────┘    │
│           │                                         │
│           │ Slack API                               │
└───────────┼─────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ Slack Cloud   │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐
    │  Your Phone   │
    │  (Slack App)  │
    └───────────────┘
```

---

## Setup Steps

### 1. Hetzner Server Setup

```bash
# SSH into server
ssh root@your-hetzner-server

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Node.js (for mom)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22
fnm use 22

# Install mom
npm install -g @mariozechner/pi-mom

# Create workspace directory
mkdir -p /opt/mom-workspace
```

### 2. Slack App Setup

1. Go to https://api.slack.com/apps → Create New App
2. Enable **Socket Mode** (Settings → Socket Mode)
3. Generate **App-Level Token** with `connections:write` → save as `MOM_SLACK_APP_TOKEN`
4. Add **Bot Token Scopes** (OAuth & Permissions):
   - `app_mentions:read`
   - `channels:history`, `channels:read`
   - `chat:write`
   - `files:read`, `files:write`
   - `groups:history`, `groups:read`
   - `im:history`, `im:read`, `im:write`
   - `users:read`
5. Subscribe to **Bot Events**:
   - `app_mention`
   - `message.channels`, `message.groups`, `message.im`
6. Enable **Messages Tab** in App Home
7. Install to workspace → save **Bot User OAuth Token** as `MOM_SLACK_BOT_TOKEN`
8. Create channel `#autonomous-builds` and invite the bot

### 3. Docker Sandbox Setup

```bash
# Create persistent sandbox container
docker run -d \
  --name mom-sandbox \
  --restart unless-stopped \
  -v /opt/mom-workspace:/workspace \
  alpine:latest \
  tail -f /dev/null

# Mom will install tools inside (git, bun, etc.)
```

### 4. Environment & Systemd Service

```bash
# Create env file
cat > /opt/mom-workspace/.env << 'EOF'
MOM_SLACK_APP_TOKEN=xapp-...
MOM_SLACK_BOT_TOKEN=xoxb-...
ANTHROPIC_API_KEY=sk-ant-...
EOF

# Create systemd service
cat > /etc/systemd/system/mom.service << 'EOF'
[Unit]
Description=Mom Slack Bot
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
EnvironmentFile=/opt/mom-workspace/.env
WorkingDirectory=/opt/mom-workspace
ExecStart=/root/.local/share/fnm/node-versions/v22.*/installation/bin/node /root/.local/share/fnm/node-versions/v22.*/installation/bin/mom --sandbox=docker:mom-sandbox /opt/mom-workspace
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable mom
systemctl start mom
systemctl status mom
```

### 5. Initial Configuration

In Slack, DM or @mention mom to set up:

```
@mom Clone the MD repository and set up the project:

git clone https://github.com/dnl-fm/md.git /workspace/md
cd /workspace/md
bun install

Remember:
- This is a Tauri + SolidJS markdown editor
- Run `make codequality` before any commit
- Never commit without explicit permission
- Ask me before making architectural decisions
```

---

## Usage Patterns

### Starting an Autonomous Task

```
@mom I need you to implement the extension rendering API from the plan.

Read: /workspace/md/docs/plans/extension-rendering-api.md

Work through Phase 1 (Prism.js integration):
1. Add prismjs to packages/extension/package.json
2. Replace highlightCodeBlocks() in content.ts
3. Run `make build` in packages/extension
4. Test the extension manually (tell me when ready)
5. If issues, fix and retry

After each milestone:
- Run make codequality
- Tell me what you completed
- Ask before moving to next phase

If you hit a decision point or blocker, ask me.
```

### Checking Progress

```
@mom What's the current status? What have you completed?
```

### Answering Questions

Mom will ask when she needs input:

```
Mom: I found two ways to handle the language detection:
1. Use Prism's auto-detection (less accurate, simpler)
2. Parse the markdown fence language (more work, accurate)

Which approach should I use?

You: Option 2 - parse the fence language. We always specify it.

Mom: Got it. Implementing fence-based language detection...
```

### Reviewing Work

```
@mom Show me the diff of what you changed in content.ts
```

```
@mom Run git status and show me what files changed
```

### Committing (Explicit Only)

```
@mom Commit the Prism.js integration with message "feat(extension): replace shiki with prismjs for code highlighting"
```

---

## Memory & Skills

### Memory (MEMORY.md)

Mom maintains memory files:

```
/workspace/MEMORY.md           # Global preferences
/workspace/<channel>/MEMORY.md # Channel-specific context
```

Set up project memory:

```
@mom Update your memory with these project rules:

## MD Project Rules

- Stack: Tauri 2 (Rust), SolidJS, TypeScript, Bun
- SolidJS NOT React - use signals, Show, For
- Always run `make codequality` before commits
- Never commit without explicit permission
- Extension is in packages/extension/
- Shared code in packages/shared/
```

### Skills

Mom can create reusable tools:

```
@mom Create a skill for running the extension build and testing:

Name: ext-build
Usage:
- `ext-build` - build extension
- `ext-build test` - build and run tests
- `ext-build package` - create .zip for Chrome Web Store
```

---

## Observer Patterns

### Progress Notifications

Ask mom to notify on milestones:

```
@mom While working, send me brief updates:
- ✅ When you complete a task
- ⚠️ When you hit an issue you're retrying
- ❓ When you need my input
- 🛑 When you're blocked and can't proceed
```

### Scheduled Check-ins

Use mom's events system:

```
@mom Set up a periodic check-in every 30 minutes while working:
- Summarize what you've done
- List any blockers
- Show remaining tasks
```

### Thread-Based Details

Mom posts clean summaries to main channel, detailed tool output in threads. Check threads for:
- Full command outputs
- Error messages
- File diffs

---

## Safety & Control

### Stop Work

```
@mom Stop what you're doing and wait for instructions
```

### Review Before Destructive Actions

Mom is instructed to ask before:
- Deleting files
- Force pushing
- Modifying configs
- Installing system packages

### Docker Isolation

- Mom runs commands in Docker sandbox
- Only `/workspace` is mounted from host
- Can't access host system files
- Container can be recreated if needed

### Audit Trail

All activity logged in:
- `/opt/mom-workspace/<channel>/log.jsonl` - Full message history
- `/opt/mom-workspace/<channel>/context.jsonl` - LLM context + tool results

---

## Workflow: Extension Rendering API

### Phase 1: Prism.js (Mom can do autonomously)

```
@mom Implement Phase 1 from /workspace/md/docs/plans/extension-rendering-api.md

Steps:
1. Add prismjs dependency to packages/extension
2. Import only these languages: javascript, typescript, jsx, tsx, python, rust, go, php, bash, json, yaml, html, css, sql, markdown, diff
3. Replace highlightCodeBlocks() in content.ts to use Prism
4. Build with `cd packages/extension && bun run build`
5. Report bundle size

Ask me when ready to test.
```

### Phase 2: API Server (Needs collaboration)

```
@mom Let's plan the Go API server for mermaid/ascii rendering.

Questions I need to answer:
1. Where should the Go project live? (separate repo or in md monorepo)
2. What's the deployment strategy? (Docker on same Hetzner server)
3. Redis vs filesystem for cache?

Propose a structure and I'll give feedback.
```

### Phase 3: Extension Integration (Mom + testing)

```
@mom Integrate the API client into the extension.

1. Create src/api.ts with renderMermaid() and renderAscii() functions
2. Update manifest.json to allow api.getmd.dev
3. Replace mermaid/ascii rendering in content.ts
4. Build and tell me when ready to test

I'll test manually on various markdown files.
```

---

## Troubleshooting

### Mom Not Responding

```bash
# Check service status
systemctl status mom

# Check logs
journalctl -u mom -f

# Restart
systemctl restart mom
```

### Docker Container Issues

```bash
# Check container
docker ps -a | grep mom-sandbox

# Recreate if needed
docker rm -f mom-sandbox
docker run -d --name mom-sandbox -v /opt/mom-workspace:/workspace alpine:latest tail -f /dev/null
systemctl restart mom
```

### Context Too Long

If mom's context fills up, she'll auto-compact. You can also:

```
@mom Compact your context, keeping focus on the current task
```

---

## Summary

| What | How |
|------|-----|
| Run autonomous tasks | `@mom` with detailed instructions |
| Answer questions | Reply in Slack (phone app works) |
| Check progress | `@mom status` or check threads |
| Stop work | `@mom stop` |
| Commit changes | Explicit `@mom commit ...` |
| Review work | `@mom git diff`, `@mom git status` |

**The key insight**: Mom handles the autonomous loop. You handle decisions. Slack is the bridge.
