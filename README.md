# Paper2Product AI (hack01)

Minimal, engaging UI + a real backend pipeline:

- Input: arXiv URL or PDF upload
- Extract: PDF → text (`pdf-parse`)
- Reason: text → structured JSON (local-first)
- Evaluate: plan faithfulness (Oumi-style evaluation)
- Output: paper understanding + MVP implementation plan + evaluation score

## Features (what it does)

- **Two input modes**: paste an arXiv URL (both `/abs` and `/pdf`) or upload a PDF.
- **Real extraction**: parses the PDF and extracts usable text before any generation.
- **Structured output (JSON)**:
  - Paper understanding: problem, methodology, architecture, inputs/outputs
  - Practical plan: recommended stack, endpoints, folder structure, dependencies, milestones
- **Evaluation layer**: optional Oumi-style faithfulness scoring (coverage + missing/hallucinated components).
- **Local-first**: runs for free using local inference (Ollama), with optional Oumi engines or OpenAI for faster demos.
- **Scaffold download (bonus)**: generates a starter ZIP (frontend + backend stubs) from the plan.

## Benefits (why it matters)

- **Faster from research to build**: converts papers into actionable engineering steps in minutes.
- **More trustworthy planning**: evaluation score makes it easier to spot missing pieces and reduce hallucinations.
- **Demo-friendly + transparent**: outputs are visible as structured sections/JSON you can copy or reuse.
- **Cost control**: limit extracted chars and optionally disable evaluation to keep runs fast/cheap.
- **Extensible**: the plan schema and evaluation layer are designed to be expanded into full repo generation workflows.

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


