# Compass · Intelligence Brief Agent

AI-powered intelligence briefing tool. Enter any domain or topic — Compass searches the web via Tavily, analyzes with Claude, and returns a structured brief.

## Architecture

```
Browser → /api/analyze → Tavily Search → Claude Analysis → Structured Brief
```

Mirrors the n8n workflow: Schedule → Tavily Search → Format Evidence → Claude Analysis → Output.

---

## Deploy to Vercel (5 minutes)

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

When prompted, set environment variables (or add them in the Vercel dashboard afterward).

### Option B — GitHub + Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. No build settings needed — Vercel auto-detects the config
4. Add environment variables under Settings → Environment Variables

### Environment Variables (required)

| Key | Where to get it |
|-----|----------------|
| `TAVILY_API_KEY` | app.tavily.com → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

---

## VPS Hosting (n8n workflows)

To host your n8n workflows on a live server:

```bash
# 1. SSH into your VPS (DigitalOcean, Hetzner, etc.)
ssh root@YOUR_VPS_IP

# 2. Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose

# 3. Create n8n docker-compose
mkdir ~/n8n && cd ~/n8n
cat > docker-compose.yml << 'EOF'
version: "3"
services:
  n8n:
    image: n8nio/n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_secure_password
      - WEBHOOK_URL=http://YOUR_VPS_IP:5678/
    volumes:
      - ~/.n8n:/home/node/.n8n
EOF

# 4. Start n8n
docker-compose up -d

# n8n is live at http://YOUR_VPS_IP:5678
```

Then: Settings → Export your local workflows → Import on the hosted instance → Re-add credentials.

---

## Submission copy (for the challenge)

**Agent Name:** Compass

**Description:** Compass is an AI-powered intelligence briefing agent that automatically searches the web for the latest developments on any domain, analyzes findings with Claude, and delivers a structured brief covering key developments, signals to watch, and strategic implications. The n8n workflow runs on a scheduled trigger, fetching subscribers from Google Sheets and emailing personalized briefs via Gmail. A companion web app on Vercel allows on-demand briefing with a customizable topic input.

**Hosting:** Vercel (web app) + [VPS provider] running n8n via Docker (automated email workflow)
