import { z } from "zod";
import { arxivIdFromUrl, arxivPdfUrl } from "@/lib/arxiv";
import { extractPdfText } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UnderstandingSchema = z.object({
  problem: z.string().min(1),
  methodology: z.string().min(1),
  architecture: z.array(z.string()).default([]),
  inputs: z.string().min(1),
  outputs: z.string().min(1)
});

const ImplementationPlanSchema = z.object({
  stack: z.object({
    frontend: z.string().min(1),
    backend: z.string().min(1),
    orchestration: z.string().optional(),
    evaluation: z.string().optional()
  }),
  apiEndpoints: z
    .array(z.object({ method: z.string().min(1), path: z.string().min(1), purpose: z.string().min(1) }))
    .default([]),
  folderStructure: z.array(z.string().min(1)).default([]),
  dependencies: z.array(z.string().min(1)).default([]),
  milestones: z.array(z.string().min(1)).default([])
});

const LlmOutputSchema = z.object({
  paper: z
    .object({
      title: z.string().optional()
    })
    .default({}),
  understanding: UnderstandingSchema,
  implementationPlan: ImplementationPlanSchema,
  meta: z
    .object({
      engine: z.string().optional(),
      model: z.string().optional(),
      generate_ms: z.number().optional(),
      eval_ms: z.number().optional(),
      eval_enabled: z.boolean().optional()
    })
    .optional(),
  evaluation: z
    .object({
      coverage_score: z.number().min(0).max(1).optional(),
      covered_components: z.array(z.string()).optional(),
      missing_components: z.array(z.string()).optional(),
      hallucinated_elements: z.array(z.string()).optional(),
      severity: z.string().optional(),
      confidence: z.string().optional()
    })
    .optional(),
  notes: z.array(z.string()).optional()
});

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  return v;
}

async function fetchPdfBufferFromArxivUrl(arxivUrlInput: string): Promise<{ buffer: Buffer; arxivId: string }> {
  const arxivId = arxivIdFromUrl(arxivUrlInput);
  if (!arxivId) throw new Error("Invalid arXiv URL. Expected https://arxiv.org/abs/<id> or /pdf/<id>.pdf");
  const pdfUrl = arxivPdfUrl(arxivId);

  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to download arXiv PDF (${res.status}).`);

  const arr = await res.arrayBuffer();
  return { buffer: Buffer.from(arr), arxivId };
}

async function callOumiService(payload: unknown) {
  const serviceUrl = env("OUMI_SERVICE_URL", "http://127.0.0.1:8001")!;
  const token = env("OUMI_SERVICE_TOKEN");
  let res: Response;
  try {
    res = await fetch(`${serviceUrl.replace(/\/+$/, "")}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Oumi-Token": token } : {})
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error(
      `Cannot reach local service at OUMI_SERVICE_URL=${serviceUrl}. Start it with: ` +
        `python oumi_service/main.py (see hack01/README.md)`
    );
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Oumi service error (${res.status}): ${text || res.statusText}`);
  const parsed = JSON.parse(text) as any;
  if (parsed && typeof parsed === "object" && typeof parsed.error === "string") {
    throw new Error(`Oumi service error: ${parsed.error}`);
  }
  return parsed as unknown;
}

export async function POST(req: Request) {
  try {
    const t0 = Date.now();
    const envMaxChars = Number(env("MAX_EXTRACT_CHARS", "18000"));

    const form = await req.formData();
    const mode = String(form.get("mode") || "");
    if (mode !== "arxiv" && mode !== "pdf") {
      return Response.json({ ok: false, error: "Invalid mode." }, { status: 400 });
    }

    const maxCharsOverrideRaw = String(form.get("maxChars") || "").trim();
    const enableEvalRaw = String(form.get("enableEval") || "").trim();
    const maxCharsOverride = maxCharsOverrideRaw ? Number(maxCharsOverrideRaw) : NaN;
    const effectiveMaxChars =
      Number.isFinite(maxCharsOverride) && maxCharsOverride >= 500 && maxCharsOverride <= 30000
        ? maxCharsOverride
        : envMaxChars;
    const enableEvalOverride =
      enableEvalRaw === "" ? undefined : !(enableEvalRaw === "0" || enableEvalRaw.toLowerCase() === "false");

    let pdfBuffer: Buffer;
    let source: "arxiv" | "pdf_upload";
    const tDownloadStart = Date.now();

    if (mode === "arxiv") {
      const arxivUrlInput = String(form.get("arxivUrl") || "");
      const { buffer } = await fetchPdfBufferFromArxivUrl(arxivUrlInput);
      pdfBuffer = buffer;
      source = "arxiv";
    } else {
      const f = form.get("pdf");
      if (!(f instanceof File)) {
        return Response.json({ ok: false, error: "Missing PDF file." }, { status: 400 });
      }
      const arr = await f.arrayBuffer();
      pdfBuffer = Buffer.from(arr);
      source = "pdf_upload";
    }
    const tDownloadEnd = Date.now();

    const tExtractStart = Date.now();
    const fullText = await extractPdfText(pdfBuffer);
    const extractedText = fullText.slice(0, Math.max(1000, effectiveMaxChars)).trim();
    if (!extractedText) throw new Error("Could not extract any text from the PDF.");
    const tExtractEnd = Date.now();

    const tServiceStart = Date.now();
    const parsed = await callOumiService({
      paper_text: extractedText,
      source,
      max_extract_chars: effectiveMaxChars,
      enable_eval: enableEvalOverride
    });
    const tServiceEnd = Date.now();

    const data = LlmOutputSchema.parse(parsed);

    const t1 = Date.now();
    return Response.json({
      ok: true,
      data: {
        paper: { ...data.paper, source, extractedChars: extractedText.length },
        understanding: data.understanding,
        implementationPlan: data.implementationPlan,
        evaluation: data.evaluation,
        notes: data.notes,
        meta: {
          total_ms: t1 - t0,
          download_ms: tDownloadEnd - tDownloadStart,
          extract_ms: tExtractEnd - tExtractStart,
          service_ms: tServiceEnd - tServiceStart,
          service: data.meta
        }
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}


