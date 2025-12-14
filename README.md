# Paper2Product AI (hack01)

Minimal, engaging UI + a real backend pipeline:

- Input: arXiv URL or PDF upload
- Extract: PDF → text (`pdf-parse`)
- Reason: text → structured JSON (local-first)
- Evaluate: plan faithfulness (Oumi-style evaluation)
- Output: paper understanding + MVP implementation plan + evaluation score

## Quickstart

From this folder:

```bash
npm install
```

Create `hack01/.env.local` (do **not** commit it). Use `hack01/env.example` as a template.

Start the local Python service (recommended):

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r oumi_service\requirements.txt
# Optional (true Oumi engines instead of Ollama):
# pip install oumi
python oumi_service\main.py
```

```bash
npm run dev
```

Open the app at Next.js dev URL shown in your terminal.

## Environment variables

Put these into `hack01/.env.local`:

- **OUMI_SERVICE_URL** (recommended): where Next.js calls the local service (default: `http://127.0.0.1:8001`)
- **OUMI_SERVICE_TOKEN** (optional): shared secret header between Next.js and the Python service
- **MAX_EXTRACT_CHARS** (optional): extracted PDF chars passed downstream (default: `18000`)
- **OPENAI_API_KEY** (optional): if set, Python service will use OpenAI (fast) instead of local Ollama
- **OPENAI_MODEL** (optional): default `gpt-4o-mini`
- **OLLAMA_BASE_URL** (optional): use free local Ollama (default: `http://127.0.0.1:11434`)
- **OLLAMA_MODEL** (optional): Ollama model name (default: `llama3.2:1b`)
- **OUMI_ENGINE / OUMI_MODEL_NAME / OUMI_GGUF_PATH** (optional): if you want the Python service to use Oumi local inference engines

## API

`POST /api/analyze` (multipart/form-data)

- **mode**: `arxiv` or `pdf`
- If `mode=arxiv`: **arxivUrl**: `https://arxiv.org/abs/...` or `https://arxiv.org/pdf/...pdf`
- If `mode=pdf`: **pdf**: uploaded file

Response:

```json
{ "ok": true, "data": { "paper": {}, "understanding": {}, "implementationPlan": {}, "evaluation": {} } }
```

## Notes

- This is a hack MVP: the “evaluation layer” is designed to be visible in the UI and extensible.
- Next step (optional): add a “Generate scaffold zip/repo” button that creates a runnable starter based on `implementationPlan`.


