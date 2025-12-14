import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Optional: OpenAI (hosted inference) to avoid local CPU slowness
_OPENAI_AVAILABLE = False
try:
    from openai import OpenAI  # type: ignore

    _OPENAI_AVAILABLE = True
except Exception:
    _OPENAI_AVAILABLE = False

# Load env from repo root so you can keep a single `hack01/.env.local`.
_HERE = Path(__file__).resolve()
_ROOT = _HERE.parent.parent
load_dotenv(_ROOT / ".env.local")
load_dotenv(_ROOT / ".env")

_OUMI_AVAILABLE = False
try:
    # Optional dependency: only needed if you want to run true Oumi inference engines locally.
    from oumi.core.configs import GenerationParams, InferenceConfig, ModelParams
    from oumi.core.types.conversation import Conversation, Message, Role
    from oumi.inference import LlamaCppInferenceEngine, NativeTextInferenceEngine, VLLMInferenceEngine

    _OUMI_AVAILABLE = True
except Exception:
    _OUMI_AVAILABLE = False


class AnalyzeRequest(BaseModel):
    paper_text: str = Field(..., min_length=1)
    source: str = Field(..., description="arxiv | pdf_upload")


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    v = os.getenv(name)
    return v if v is not None else default


def _abstract_chunk(text: str, max_len: int = 2000) -> str:
    t = text.replace("\r\n", "\n")
    lower = t.lower()
    idx = lower.find("abstract")
    if idx != -1:
        chunk = t[idx : idx + max_len]
        return chunk.strip()
    return t[:max_len].strip()


def _heuristic_output(paper_text: str) -> Dict[str, Any]:
    chunk = _abstract_chunk(paper_text, 1500)
    # ultra-light heuristic: keep it short and usable
    return {
        "paper": {},
        "understanding": {
            "problem": "Extracted from paper excerpt (heuristic mode).",
            "methodology": "Summarize + plan generation requires a local model (Oumi/Ollama).",
            "architecture": [],
            "inputs": "Research paper (PDF/arXiv).",
            "outputs": "Structured JSON plan + evaluation.",
        },
        "implementationPlan": {
            "stack": {
                "frontend": "Next.js (App Router) + Tailwind",
                "backend": "Next.js API route + local Python service",
                "orchestration": "Kestra (optional)",
                "evaluation": "Oumi (local inference engines / judge-style evaluation)",
            },
            "apiEndpoints": [
                {"method": "POST", "path": "/api/analyze", "purpose": "PDF/arXiv → text → plan + evaluation"},
            ],
            "folderStructure": [
                "app/",
                "app/api/analyze/",
                "components/",
                "lib/",
                "oumi_service/",
            ],
            "dependencies": [
                "next",
                "tailwindcss",
                "pdf-parse",
                "fastapi",
                "requests",
            ],
            "milestones": [
                "Parse paper (PDF/arXiv) and extract text",
                "Generate methodology summary + implementation plan JSON",
                "Run evaluation layer to score faithfulness",
                "Render plan + evaluation in UI",
            ],
        },
        "evaluation": {
            "coverage_score": 0.0,
            "covered_components": [],
            "missing_components": ["Local model not configured (heuristic mode)"],
            "hallucinated_elements": [],
            "severity": "low",
            "confidence": "low",
        },
        "notes": [
            "Heuristic fallback: configure OLLAMA_* for free local LLM, or install/use Oumi engines for stronger results.",
            f"Excerpt preview: {chunk[:240]}{'...' if len(chunk) > 240 else ''}",
        ],
    }


def _ollama_chat_json(model: str, messages: List[Dict[str, str]]) -> str:
    base = _env("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    # Ollama supports structured JSON output via `format: "json"` (best-effort).
    timeout_s = float(_env("OLLAMA_TIMEOUT_SEC", "600") or "600")
    num_predict = int(_env("OLLAMA_NUM_PREDICT", "512") or "512")
    num_ctx = int(_env("OLLAMA_NUM_CTX", "2048") or "2048")
    temperature = float(_env("OLLAMA_TEMPERATURE", "0.2") or "0.2")
    try:
        res = requests.post(
            f"{base}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "format": "json",
                "options": {
                    # Keep CPU demo fast and bounded.
                    "num_predict": num_predict,
                    "num_ctx": num_ctx,
                    "temperature": temperature,
                },
            },
            timeout=timeout_s,
        )
    except requests.exceptions.ReadTimeout as e:
        hint = (
            "Ollama timed out while generating.\n"
            "Fixes:\n"
            "- Increase OLLAMA_TIMEOUT_SEC (e.g. 600 or 1200)\n"
            "- Reduce MAX_EXTRACT_CHARS (e.g. 4000–8000)\n"
            "- Use a smaller model (e.g. `ollama pull llama3.2:1b` and set OLLAMA_MODEL=llama3.2:1b)\n"
            "- For fastest demo, disable evaluation: set ENABLE_EVAL=0\n"
            "- Warm the model once: `ollama run <model> \"hi\"`\n"
        )
        raise RuntimeError(f"{e}\n\n{hint}") from e
    if not res.ok:
        detail = ""
        try:
            detail = res.text
        except Exception:
            detail = ""
        hint = (
            "Common fixes:\n"
            "- Ensure Ollama is running: `ollama serve`\n"
            "- Ensure the model exists: `ollama pull <model>` and set OLLAMA_MODEL to the exact name\n"
            "- Verify base URL: OLLAMA_BASE_URL should usually be http://127.0.0.1:11434\n"
            "- Check tags: curl http://127.0.0.1:11434/api/tags\n"
        )
        raise RuntimeError(f"Ollama /api/chat failed ({res.status_code}). Body: {detail}\n\n{hint}")
    data = res.json()
    content = (data.get("message") or {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Ollama returned empty content.")
    return content


def _extract_json_obj(text: str) -> Optional[str]:
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


_OUMI_ENGINE = None


def _parse_model_json(raw: str) -> Dict[str, Any]:
    s = (raw or "").strip()
    if not s:
        raise RuntimeError("Model returned empty output.")

    # Quick truncation detection (very common when num_predict is too low).
    if not s.endswith("}"):
        raise RuntimeError(
            "Model output looks truncated (does not end with `}`). "
            "Increase OLLAMA_NUM_PREDICT (e.g. 800–1500) or reduce MAX_EXTRACT_CHARS."
        )

    try:
        obj = json.loads(s)
        if not isinstance(obj, dict):
            raise RuntimeError("Model JSON must be a JSON object.")
        return obj
    except json.JSONDecodeError as e:
        candidate = _extract_json_obj(s)
        if candidate:
            try:
                obj = json.loads(candidate)
                if not isinstance(obj, dict):
                    raise RuntimeError("Model JSON must be a JSON object.")
                return obj
            except json.JSONDecodeError:
                pass

        preview = s[:800].replace("\n", "\\n")
        raise RuntimeError(f"Invalid JSON from model: {e}. Preview: {preview}")


def _ensure_plan_shape(obj: Dict[str, Any], paper_text: str, context: str) -> Dict[str, Any]:
    """
    The UI expects these top-level keys:
    - understanding (object)
    - implementationPlan (object)
    If the model returns partial/incorrect JSON, we downgrade to a heuristic plan
    and carry the model output in notes for debugging/demo transparency.
    """
    if not isinstance(obj, dict):
        base = _heuristic_output(paper_text)
        base["notes"] = list(base.get("notes", [])) + [f"{context}: non-object output, using heuristic fallback"]
        return base

    has_understanding = isinstance(obj.get("understanding"), dict)
    has_plan = isinstance(obj.get("implementationPlan"), dict)
    if has_understanding and has_plan:
        return obj

    base = _heuristic_output(paper_text)
    base["notes"] = list(base.get("notes", [])) + [
        f"{context}: model output missing required keys; using heuristic fallback",
        "Raw model output (truncated): " + json.dumps(obj, ensure_ascii=False)[:1200],
    ]
    base["evaluation"] = {
        "coverage_score": 0.0,
        "covered_components": [],
        "missing_components": ["Model output did not match schema; fallback used"],
        "hallucinated_elements": [],
        "severity": "high",
        "confidence": "high",
    }
    return base


def _get_oumi_engine():
    global _OUMI_ENGINE
    if _OUMI_ENGINE is not None:
        return _OUMI_ENGINE

    if not _OUMI_AVAILABLE:
        raise RuntimeError("Oumi is not installed. Install it with: pip install oumi")

    engine_kind = (_env("OUMI_ENGINE", "") or "").strip().lower()
    model_name = _env("OUMI_MODEL_NAME", "meta-llama/Llama-3.2-1B-Instruct")

    if engine_kind in ("native", "transformers"):
        _OUMI_ENGINE = NativeTextInferenceEngine(
            ModelParams(
                model_name=model_name,
                model_kwargs={
                    # You can override these via Oumi config if needed.
                    "device_map": _env("OUMI_DEVICE_MAP", "auto"),
                },
            )
        )
    elif engine_kind in ("llamacpp", "llama.cpp"):
        gguf_path = _env("OUMI_GGUF_PATH")
        if not gguf_path:
            raise RuntimeError("Missing OUMI_GGUF_PATH for OUMI_ENGINE=llamacpp")
        _OUMI_ENGINE = LlamaCppInferenceEngine(
            ModelParams(
                model_name=gguf_path,
                model_kwargs={
                    "n_gpu_layers": int(_env("OUMI_N_GPU_LAYERS", "0")),
                    "n_ctx": int(_env("OUMI_N_CTX", "2048")),
                    "n_batch": int(_env("OUMI_N_BATCH", "512")),
                    "low_vram": True,
                },
            )
        )
    elif engine_kind == "vllm":
        _OUMI_ENGINE = VLLMInferenceEngine(ModelParams(model_name=model_name))
    else:
        raise RuntimeError(
            "Set OUMI_ENGINE to one of: native | llamacpp | vllm (or leave unset to use Ollama/heuristics)."
        )

    return _OUMI_ENGINE


def _oumi_infer_text(system: str, user: str) -> str:
    engine = _get_oumi_engine()
    conv = Conversation(
        messages=[
            Message(role=Role.SYSTEM, content=system),
            Message(role=Role.USER, content=user),
        ]
    )
    config = InferenceConfig(
        generation=GenerationParams(
            max_new_tokens=int(_env("OUMI_MAX_NEW_TOKENS", "700")),
            temperature=float(_env("OUMI_TEMPERATURE", "0.2")),
        )
    )
    result = engine.infer([conv], config)
    return str(result[0].messages[-1].content)


def _generate_with_oumi(paper_text: str) -> Dict[str, Any]:
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "18000"))]
    schema = """{
  "paper": { "title": string? },
  "understanding": {
    "problem": string,
    "methodology": string,
    "architecture": string[],
    "inputs": string,
    "outputs": string
  },
  "implementationPlan": {
    "stack": { "frontend": string, "backend": string, "orchestration": string?, "evaluation": string? },
    "apiEndpoints": [{ "method": string, "path": string, "purpose": string }],
    "folderStructure": string[],
    "dependencies": string[],
    "milestones": string[]
  },
  "notes": string[]?
}"""
    raw = _oumi_infer_text(
        system="You are Paper2Product AI. Return STRICT JSON only (no markdown). Keep it concise and engineering-focused.",
        user=f"Create a structured understanding + MVP implementation plan.\nSchema:\n{schema}\n\nPaper excerpt:\n{excerpt}",
    )
    try:
        return json.loads(raw)
    except Exception:
        candidate = _extract_json_obj(raw)
        if not candidate:
            raise
        return json.loads(candidate)


def _evaluate_with_oumi(paper_text: str, plan_json: Dict[str, Any]) -> Dict[str, Any]:
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "18000"))]
    eval_schema = """{
  "coverage_score": number,              // 0..1
  "covered_components": string[],
  "missing_components": string[],
  "hallucinated_elements": string[],
  "severity": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high"
}"""
    raw = _oumi_infer_text(
        system="You are an evaluation layer. Compare the paper excerpt to the generated plan and return STRICT JSON only.",
        user="Evaluate faithfulness.\n"
        f"Schema:\n{eval_schema}\n\nPAPER EXCERPT:\n{excerpt}\n\nGENERATED PLAN JSON:\n{json.dumps(plan_json, ensure_ascii=False)[:6000]}",
    )
    try:
        return json.loads(raw)
    except Exception:
        candidate = _extract_json_obj(raw)
        if not candidate:
            raise
        return json.loads(candidate)


def _generate_with_ollama(paper_text: str) -> Dict[str, Any]:
    # CPU-friendly default
    model = _env("OLLAMA_MODEL", "llama3.2:1b")
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "8000"))]

    schema = """{
  "paper": { "title": string? },
  "understanding": {
    "problem": string,
    "methodology": string,
    "architecture": string[],
    "inputs": string,
    "outputs": string
  },
  "implementationPlan": {
    "stack": { "frontend": string, "backend": string, "orchestration": string?, "evaluation": string? },
    "apiEndpoints": [{ "method": string, "path": string, "purpose": string }],
    "folderStructure": string[],
    "dependencies": string[],
    "milestones": string[]
  },
  "notes": string[]?
}"""

    messages = [
        {
            "role": "system",
            "content": "You are Paper2Product AI. Return STRICT JSON only (no markdown). Keep it concise and engineering-focused.",
        },
        {
            "role": "user",
            "content": f"Create a structured understanding + MVP implementation plan.\nSchema:\n{schema}\n\nPaper excerpt:\n{excerpt}",
        },
    ]

    raw = _ollama_chat_json(model, messages)
    try:
        return _ensure_plan_shape(_parse_model_json(raw), paper_text, "generate")
    except Exception:
        # Retry once with stricter "minified JSON" instruction.
        messages_retry = [
            {
                "role": "system",
                "content": "Return STRICT VALID JSON ONLY. Minified JSON only. Use double quotes. No newlines inside strings.",
            },
            {
                "role": "user",
                "content": f"Return a compact JSON object (keep it short). Schema:\n{schema}\n\nPaper excerpt:\n{excerpt}",
            },
        ]
        raw2 = _ollama_chat_json(model, messages_retry)
        return _ensure_plan_shape(_parse_model_json(raw2), paper_text, "generate(retry)")


def _evaluate_with_ollama(paper_text: str, plan_json: Dict[str, Any]) -> Dict[str, Any]:
    # CPU-friendly default
    model = _env("OLLAMA_MODEL", "llama3.2:1b")
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "8000"))]

    eval_schema = """{
  "coverage_score": number,              // 0..1
  "covered_components": string[],
  "missing_components": string[],
  "hallucinated_elements": string[],
  "severity": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high"
}"""

    messages = [
        {
            "role": "system",
            "content": "You are an evaluation layer. Compare the paper excerpt to the generated plan and return STRICT JSON only.",
        },
        {
            "role": "user",
            "content": "Evaluate faithfulness.\n"
            f"Schema:\n{eval_schema}\n\nPAPER EXCERPT:\n{excerpt}\n\nGENERATED PLAN JSON:\n{json.dumps(plan_json, ensure_ascii=False)[:6000]}",
        },
    ]

    raw = _ollama_chat_json(model, messages)
    return _parse_model_json(raw)


def _openai_client() -> "OpenAI":
    if not _OPENAI_AVAILABLE:
        raise RuntimeError("OpenAI SDK not installed. Run: pip install -r oumi_service/requirements.txt")
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY")
    base_url = _env("OPENAI_BASE_URL")
    # base_url is optional; leave unset for default OpenAI API.
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


def _openai_chat_json(messages: List[Dict[str, str]]) -> str:
    client = _openai_client()
    model = _env("OPENAI_MODEL", "gpt-4o-mini")
    timeout_s = float(_env("OPENAI_TIMEOUT_SEC", "60") or "60")

    # Use JSON response formatting when supported by the model.
    resp = client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        temperature=float(_env("OPENAI_TEMPERATURE", "0.2") or "0.2"),
        response_format={"type": "json_object"},
        timeout=timeout_s,
    )
    content = resp.choices[0].message.content
    if not content:
        raise RuntimeError("OpenAI returned empty content.")
    return content


def _generate_with_openai(paper_text: str) -> Dict[str, Any]:
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "8000"))]

    schema = """{
  "paper": { "title": string? },
  "understanding": {
    "problem": string,
    "methodology": string,
    "architecture": string[],
    "inputs": string,
    "outputs": string
  },
  "implementationPlan": {
    "stack": { "frontend": string, "backend": string, "orchestration": string?, "evaluation": string? },
    "apiEndpoints": [{ "method": string, "path": string, "purpose": string }],
    "folderStructure": string[],
    "dependencies": string[],
    "milestones": string[]
  },
  "notes": string[]?
}"""

    messages = [
        {
            "role": "system",
            "content": "You are Paper2Product AI. Return STRICT VALID JSON only (no markdown). Keep it concise and engineering-focused.",
        },
        {
            "role": "user",
            "content": f"Create a structured understanding + MVP implementation plan.\nSchema:\n{schema}\n\nPaper excerpt:\n{excerpt}",
        },
    ]

    raw = _openai_chat_json(messages)
    return _ensure_plan_shape(_parse_model_json(raw), paper_text, "generate(openai)")


def _evaluate_with_openai(paper_text: str, plan_json: Dict[str, Any]) -> Dict[str, Any]:
    excerpt = paper_text[: int(_env("MAX_EXTRACT_CHARS", "8000"))]
    eval_schema = """{
  "coverage_score": number,              // 0..1
  "covered_components": string[],
  "missing_components": string[],
  "hallucinated_elements": string[],
  "severity": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high"
}"""

    messages = [
        {
            "role": "system",
            "content": "You are an evaluation layer. Compare the paper excerpt to the generated plan and return STRICT JSON only.",
        },
        {
            "role": "user",
            "content": "Evaluate faithfulness.\n"
            f"Schema:\n{eval_schema}\n\nPAPER EXCERPT:\n{excerpt}\n\nGENERATED PLAN JSON:\n{json.dumps(plan_json, ensure_ascii=False)[:6000]}",
        },
    ]
    raw = _openai_chat_json(messages)
    return _parse_model_json(raw)


def generate_and_evaluate(paper_text: str) -> Dict[str, Any]:
    """
    Oumi note:
    - Oumi is best thought of as the orchestration layer for running inference engines
      (vLLM / llama.cpp / Transformers) + evaluation flows (judge/metrics).
    - For this MVP, we provide a 'local-first' path that works out-of-the-box with Ollama,
      and a heuristic fallback if no model is configured.
    """
    # Prefer Oumi engines if configured, otherwise fall back to free/local Ollama, otherwise heuristics.
    oumi_engine = (_env("OUMI_ENGINE", "") or "").strip()
    use_oumi = bool(oumi_engine)
    use_openai = bool(_env("OPENAI_API_KEY"))
    use_ollama = bool(_env("OLLAMA_BASE_URL")) or bool(_env("OLLAMA_MODEL"))
    enable_eval = (_env("ENABLE_EVAL", "1") or "1").strip() not in ("0", "false", "no")

    if use_oumi:
        plan = _ensure_plan_shape(_generate_with_oumi(paper_text), paper_text, "generate(oumi)")
        if enable_eval:
            evaluation = _evaluate_with_oumi(paper_text, plan)
            plan["evaluation"] = evaluation
        return plan

    if use_openai:
        plan = _ensure_plan_shape(_generate_with_openai(paper_text), paper_text, "generate(openai)")
        if enable_eval:
            evaluation = _evaluate_with_openai(paper_text, plan)
            plan["evaluation"] = evaluation
        return plan

    if use_ollama:
        plan = _ensure_plan_shape(_generate_with_ollama(paper_text), paper_text, "generate(ollama)")
        if enable_eval:
            evaluation = _evaluate_with_ollama(paper_text, plan)
            plan["evaluation"] = evaluation
        return plan

    return _heuristic_output(paper_text)


app = FastAPI(title="Paper2Product Oumi Service", version="0.1.0")


@app.post("/analyze")
def analyze(req: AnalyzeRequest, x_oumi_token: Optional[str] = Header(default=None)):
    expected = _env("OUMI_SERVICE_TOKEN")
    if expected:
        if not x_oumi_token or x_oumi_token != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        return generate_and_evaluate(req.paper_text)
    except Exception as e:
        # Demo-first behavior:
        # Always return a plan-shaped JSON so the UI doesn't break, but surface the failure.
        fallback = _heuristic_output(req.paper_text)
        fallback.setdefault("notes", [])
        fallback["notes"] = list(fallback["notes"]) + [f"Model/Eval error: {e}"]
        fallback["evaluation"] = {
            "coverage_score": 0.0,
            "covered_components": [],
            "missing_components": ["Generation failed; using heuristic fallback"],
            "hallucinated_elements": [],
            "severity": "high",
            "confidence": "high",
        }
        return JSONResponse(status_code=200, content=fallback)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=_env("OUMI_SERVICE_HOST", "127.0.0.1"),
        port=int(_env("OUMI_SERVICE_PORT", "8001")),
    )


