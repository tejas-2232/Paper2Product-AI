# Deploy Option B (Vercel + GCP)

Goal:
- **Vercel** hosts the Next.js UI + `/api/analyze`
- **GCP** hosts the Python `oumi_service` (inference + evaluation)
- Next.js calls the service via `OUMI_SERVICE_URL` (and optional `OUMI_SERVICE_TOKEN`)

## 1) GPU inference on Compute Engine (recommended)

This is the simplest **reliable** way to use your GCP credits for real model quality.

### A) Create a GPU VM (console is easiest)
Create a **Compute Engine VM** with:
- **GPU**: NVIDIA T4 / L4 (pick what’s available in your region/zone)
- **Disk**: 100–200GB (models take space)
- **Image**: preferably a **Deep Learning VM** image with NVIDIA drivers/CUDA already handled

### B) On the VM: install & run Ollama (easy model hosting)
Ollama will use GPU automatically if available.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull llama3.2:3b
```

### C) Run the Python service (Docker, on the same VM)
We provide `oumi_service/Dockerfile`.

```bash
cd ~/paper2product-ai/hack01/oumi_service
docker build -t paper2product-oumi-service:latest .
```

Run it (host network keeps `OLLAMA_BASE_URL` as `127.0.0.1`):

```bash
export OUMI_SERVICE_TOKEN="your-long-random-string"
docker run -d --name oumi_service --restart unless-stopped --network host \
  -e OUMI_SERVICE_HOST=0.0.0.0 \
  -e OUMI_SERVICE_PORT=8001 \
  -e OUMI_SERVICE_TOKEN="$OUMI_SERVICE_TOKEN" \
  -e OLLAMA_BASE_URL="http://127.0.0.1:11434" \
  -e OLLAMA_MODEL="llama3.2:3b" \
  -e MAX_EXTRACT_CHARS=18000 \
  paper2product-oumi-service:latest
```

### D) Open port 8001 on the VM (firewall)
Open **TCP 8001** (or use a tighter source range later). Since we require `OUMI_SERVICE_TOKEN`, the endpoint isn’t wide open.

### E) Point Vercel to the VM service
In **Vercel → Project → Environment Variables**:

- `OUMI_SERVICE_URL=http://<VM_EXTERNAL_IP>:8001`
- `OUMI_SERVICE_TOKEN=<same long random string>`
- `MAX_EXTRACT_CHARS=18000`

> Optional hardening: put Nginx/Caddy in front and serve HTTPS.

## 2) (Optional) True Oumi engines instead of Ollama

If you want to use Oumi inference engines directly (Transformers / llama.cpp / vLLM), you’ll need to install additional Python deps (e.g. `oumi`, and often `torch`, `transformers`, etc.) and configure:
- `OUMI_ENGINE=native` and `OUMI_MODEL_NAME=...`, or
- `OUMI_ENGINE=llamacpp` and `OUMI_GGUF_PATH=/path/to/model.gguf`

For hack reliability on a GPU VM, Ollama is usually the smoothest path.

## 4) Security note

If your service is public, set **`OUMI_SERVICE_TOKEN`** on both sides:
- Next.js sends `X-Oumi-Token`
- Python validates it


