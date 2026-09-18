# 🚀 Deployment Runbook: Billionaire Brother Edge Worker

**Target Host:** `sienvi-edge-vps-01` (`2.28.32.45`)  
**Datacenter:** Hetzner Falkenstein `fsn1`  
**User:** `appuser` (UID 1000)  
**Target Path:** `/opt/sebastian/app`  

---

## 1. Prerequisites Check
Verify SSH connectivity into the live Hetzner node:
```bash
ssh -i ~/.ssh/id_ed25519 appuser@2.28.32.45
```
*(Verify UFW is active and password authentication is disabled).*

---

## 2. Copy Worker Stack to Edge Node
From your local workstation (`c:\Users\spenc\projects\agentic-billionaire-brother\deploy\vps`):

```bash
# Copy docker-compose, Dockerfile, and code to /opt/sebastian/app
scp -i ~/.ssh/id_ed25519 docker-compose.yml Dockerfile appuser@2.28.32.45:/opt/sebastian/app/
scp -r -i ~/.ssh/id_ed25519 code appuser@2.28.32.45:/opt/sebastian/app/
```

---

## 3. Configure Runtime Environment
SSH into the server and set up the memory-only `.env`:

```bash
ssh -i ~/.ssh/id_ed25519 appuser@2.28.32.45

# Navigate to app directory
cd /opt/sebastian/app

# Create your .env file with your actual keys
nano .env
```

Paste in the keys (using `.env.example` as reference):
- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_AUTH_TOKEN`

---

## 4. Build and Start the Stack
Run Docker Compose as non-root `appuser`:

```bash
cd /opt/sebastian/app
docker compose pull
docker compose build
docker compose up -d
```

---

## 5. Verify Health & Logs
Check container statuses:
```bash
docker compose ps
```

Verify the health check endpoint:
```bash
curl http://127.0.0.1:8088/health
```
Expected output:
```json
{"status":"healthy","uptime_seconds":12,"concurrency":2}
```

Check structured JSON logs:
```bash
docker compose logs -f bb-worker
```

---

## 6. Trigger Test Swarm Job
Test the webhook worker with a curl command:

```bash
curl -X POST http://127.0.0.1:8088/webhook/job \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WORKER_AUTH_TOKEN" \
  -d '{
    "jobId": "test_sprint_001",
    "userProfile": {
      "business_name": "Sienvi Edge Test",
      "industry": "B2B SaaS",
      "hours_per_week": 10,
      "sells_one_liner": "Revenue velocity machine for founders under $20k"
    },
    "chosenStrategy": {
      "name": "Cash & Clarity",
      "thesis": "Direct B2B outreach + high-converting landing page"
    }
  }'
```

Check `/opt/sebastian/drafts/` to see the generated Strategy Brief and Week 1 Ship Pack JSON!
