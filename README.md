# Paper2Product AI (hack01)

Minimal, engaging UI + a real backend pipeline:

- Input: arXiv URL or PDF upload
- Extract: PDF → text (`pdf-parse`)
- Reason: text → structured JSON (local-first)
- Evaluate: plan faithfulness (Oumi-style evaluation)
- Output: paper understanding + MVP implementation plan + evaluation score

## Screenshots

<img width="1503" height="926" alt="shows first page of product, pipeline, generate plan button" src="https://github.com/user-attachments/assets/294ddcad-3d84-4d18-b490-a37c21a13b28" />

<img width="604" height="984" alt="shows inputs, outputs, practical engineering plan, api endpoints, folder structure" src="https://github.com/user-attachments/assets/22741932-c903-460d-ad79-16897d284161" />


## Features (what it does)

- **Two input modes**: paste an arXiv URL (both `/abs` and `/pdf`) or upload a PDF.
- **Real extraction**: parses the PDF and extracts usable text before any generation.
- **Structured output (JSON)**:
  - Paper understanding: problem, methodology, architecture, inputs/outputs
  - Practical plan: recommended stack, endpoints, folder structure, dependencies, milestones
- **Evaluation layer**: optional Oumi-style faithfulness scoring (coverage + missing/hallucinated components).
- **Local-first**: runs for free using local inference (Ollama), with optional Oumi engines or OpenAI for faster demos.
- **Scaffold download (bonus)**: generates a starter ZIP (frontend + backend stubs) from the plan.
- **Storytelling UI**:
  - Pipeline timeline (Download → Extract → Plan → Eval) with real timings
  - Endpoint explorer drawer (click an endpoint to view details)
  - Folder structure rendered as a collapsible tree
  - “Debug: raw JSON” section for demo transparency

## Benefits (why it matters)

- **Faster from research to build**: converts papers into actionable engineering steps in minutes.
- **More trustworthy planning**: evaluation score makes it easier to spot missing pieces and reduce hallucinations.
- **Demo-friendly + transparent**: outputs are visible as structured sections/JSON you can copy or reuse.
- **Cost control**: limit extracted chars and optionally disable evaluation to keep runs fast/cheap.
- **Extensible**: the plan schema and evaluation layer are designed to be expanded into full repo generation workflows.

## Oumi usage (for Oumi track judges)

This repo uses **Oumi** in two ways:

1) **Oumi-style generation + evaluation service** (local-first)
- Python service: `hack01/oumi_service/main.py`
- Supports **Oumi local inference engines** (set `OUMI_ENGINE`, `OUMI_MODEL_NAME`, `OUMI_GGUF_PATH`)
- Runs an **evaluation pass** that scores plan faithfulness vs the paper excerpt (LLM-as-a-judge style)

2) **Oumi Reinforcement Learning fine-tuning (RLFT)** via a DPO recipe
- RLFT config: `hack01/oumi_rlft/dpo_recipe.yaml`
- Run:
  ```bash
  pip install -r oumi_service/requirements.txt
  oumi train -c hack01/oumi_rlft/dpo_recipe.yaml
  ```

Relevant links:
- Oumi GitHub: `https://github.com/oumi-ai/oumi`
- Oumi training methods (RLFT): `https://oumi.ai/docs/en/latest/user_guides/train/training_methods.html`
- Oumi training configuration: `https://oumi.ai/docs/en/latest/user_guides/train/configuration.html`

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
- **ENABLE_EVAL** (optional): set `0` to disable evaluation for faster demos
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

### Timing metadata (for the UI timeline)

The UI timeline is powered by:
- Next.js API timings (download/extract/service/total) added in `/app/api/analyze/route.ts`
- LLM timings (generate/eval + engine/model) added in `/oumi_service/main.py` under `meta`

## Notes

- This is a hack MVP: the “evaluation layer” is designed to be visible in the UI and extensible.
- Next step (optional): add a “Generate scaffold zip/repo” button that creates a runnable starter based on `implementationPlan`.

## Links (for judges)

- **Repo**:
- **Live demo**:
- **Demo video**:
- **Key code**:
  - Next.js API route: `hack01/app/api/analyze/route.ts`
  - Python service (generation + evaluation): `hack01/oumi_service/main.py`
  - Deployment notes (Vercel + GCP option): `hack01/DEPLOY_GCP.md`

## Sponsor tracks (optional)

> Leave the sponsor fields empty if you are not applying to that track.

### The Infinity Build Award – $5,000 (Cline CLI)

- **Sponsor**:
- **Applying**: No
- **Relevant links**:
- **How we used the tool (CLI automation)**:

### The Wakanda Data Award – $4,000 (Kestra built-in AI Agent)

- **Sponsor**:
- **Applying**: No
- **Relevant links**:
- **How we used Kestra’s AI Agent (summaries + decisions)**:

### The Iron Intelligence Award – $3,000 (Oumi + RL fine-tuning)

- **Sponsor**:
- **Applying**: No
- **Relevant links**:
- **How we used Oumi RL fine-tuning**:

### The Stormbreaker Deployment Award – $2,000 (Vercel live deployment)

- **Sponsor**:
- **Applying**: No
- **Relevant links**:
- **How we deployed on Vercel**:

### The Captain Code Award – $1,000 (CodeRabbit PR reviews)

- **Sponsor**:
- **Applying**: No
- **Relevant links**:
- **How we used CodeRabbit (PRs, docs, best practices)**:
