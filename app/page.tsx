/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Copy, Download, FileText, Link2, Loader2, Wand2 } from "lucide-react";
import JSZip from "jszip";
import { Badge, Button, Card, Input, Label, Skeleton, cn } from "@/components/ui";
import { useToast } from "@/components/toast";

type AnalyzeResult = {
  paper: {
    title?: string;
    source: "arxiv" | "pdf_upload";
    extractedChars: number;
  };
  understanding: {
    problem: string;
    methodology: string;
    architecture: string[];
    inputs: string;
    outputs: string;
  };
  implementationPlan: {
    stack: { frontend: string; backend: string; orchestration?: string; evaluation?: string };
    apiEndpoints: Array<{ method: string; path: string; purpose: string }>;
    folderStructure: string[];
    dependencies: string[];
    milestones: string[];
  };
  evaluation?: {
    coverage_score?: number;
    covered_components?: string[];
    missing_components?: string[];
    hallucinated_elements?: string[];
    severity?: string;
    confidence?: string;
  };
  notes?: string[];
  meta?: {
    total_ms?: number;
    download_ms?: number;
    extract_ms?: number;
    service_ms?: number;
    service?: {
      engine?: string;
      model?: string;
      generate_ms?: number;
      eval_ms?: number;
      eval_enabled?: boolean;
    };
  };
};

function CodeBlock({ value }: { value: string }) {
  return (
    <pre className="overflow-auto rounded-xl border border-border bg-black/40 p-4 text-xs leading-relaxed text-text">
      <code>{value}</code>
    </pre>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted">{children}</div>;
}

type Endpoint = { method: string; path: string; purpose: string };

function ms(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

type TreeNode = { children: Record<string, TreeNode> };
function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { children: {} };
  for (const raw of paths) {
    const p = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!p) continue;
    const parts = p.split("/").filter(Boolean);
    let cur = root;
    for (const part of parts) {
      cur.children[part] ??= { children: {} };
      cur = cur.children[part];
    }
  }
  return root;
}

function TreeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const entries = Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return <div className="text-sm text-muted">(empty)</div>;
  return (
    <div className="text-sm">
      {entries.map(([name, child]) => {
        const hasKids = Object.keys(child.children).length > 0;
        return (
          <details key={`${depth}-${name}`} open={depth < 1} className="group">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 hover:bg-white/5">
              <span className="inline-flex items-center gap-2">
                <span className="text-muted" style={{ width: 18 }}>
                  {hasKids ? "▸" : "•"}
                </span>
                <span className="font-mono text-xs">{name}</span>
              </span>
            </summary>
            {hasKids ? (
              <div className="ml-6 border-l border-border pl-2">
                <TreeView node={child} depth={depth + 1} />
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"arxiv" | "pdf">("arxiv");
  const [arxivUrl, setArxivUrl] = useState("https://arxiv.org/abs/1706.03762");
  const [presetKey, setPresetKey] = useState<string>("transformer");
  const [profile, setProfile] = useState<"fast" | "quality">("fast");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);
  const [previewSelected, setPreviewSelected] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<Record<string, string>>({});
  const [previewZipBlob, setPreviewZipBlob] = useState<Blob | null>(null);
  const previewZipRef = useRef<JSZip | null>(null);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (mode === "arxiv") return arxivUrl.trim().length > 0;
    return Boolean(fileRef.current?.files?.[0]);
  }, [mode, arxivUrl, busy]);

  const presets = useMemo(
    () =>
      [
        {
          key: "transformer",
          label: "Transformer (Attention Is All You Need)",
          url: "https://arxiv.org/abs/1706.03762"
        },
        { key: "bert", label: "BERT", url: "https://arxiv.org/abs/1810.04805" },
        { key: "clip", label: "CLIP", url: "https://arxiv.org/abs/2103.00020" },
        { key: "stable_diffusion", label: "Stable Diffusion", url: "https://arxiv.org/abs/2112.10752" }
      ] as const,
    []
  );

  const profileConfig = useMemo(() => {
    if (profile === "fast") return { maxChars: 3000, enableEval: false, label: "Fast" as const };
    return { maxChars: 9000, enableEval: true, label: "Quality" as const };
  }, [profile]);

  async function onAnalyze() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("mode", mode);
      if (mode === "arxiv") fd.set("arxivUrl", arxivUrl.trim());
      if (mode === "pdf") {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error("Please select a PDF first.");
        fd.set("pdf", file);
      }
      fd.set("maxChars", String(profileConfig.maxChars));
      fd.set("enableEval", profileConfig.enableEval ? "1" : "0");

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const body = (await res.json()) as { ok: boolean; error?: string; data?: AnalyzeResult };
      if (!res.ok || !body.ok || !body.data) throw new Error(body.error || "Failed to analyze.");
      setResult(body.data);
      toast.push({ tone: "good", title: "Plan ready", message: "Generated understanding + engineering plan." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      toast.push({ tone: "bad", title: "Failed", message: msg, durationMs: 4200 });
    } finally {
      setBusy(false);
    }
  }

  const json = useMemo(() => (result ? JSON.stringify(result, null, 2) : ""), [result]);
  const tree = useMemo(() => buildTree(result?.implementationPlan.folderStructure || []), [result]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.push({ tone: "good", title: "Copied", message: "Copied to clipboard." });
  }

  async function buildScaffoldZip(): Promise<{ blob: Blob; zip: JSZip; files: string[] }> {
    if (!result) throw new Error("No result to scaffold.");
    const res = await fetch("/api/scaffold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paper: { title: result.paper.title },
        understanding: result.understanding,
        implementationPlan: result.implementationPlan
      })
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "Failed to generate scaffold.");
    }
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const files = Object.keys(zip.files).filter((p) => !zip.files[p]?.dir);
    return { blob, zip, files };
  }

  async function ensurePreviewFile(path: string) {
    if (previewContent[path]) return;
    const zip = previewZipRef.current;
    if (!zip) return;
    const file = zip.file(path);
    if (!file) return;
    const text = await file.async("string");
    setPreviewContent((m) => ({ ...m, [path]: text }));
  }

  async function openPreview() {
    if (!result) return;
    setPreviewOpen(true);
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      const { blob, zip, files } = await buildScaffoldZip();
      previewZipRef.current = zip;
      setPreviewZipBlob(blob);
      setPreviewFiles(files);
      const defaultFile =
        files.find((f) => f.endsWith("/README.md")) ||
        files.find((f) => f.toLowerCase().includes("readme")) ||
        files[0] ||
        null;
      setPreviewSelected(defaultFile);
      if (defaultFile) await ensurePreviewFile(defaultFile);
      toast.push({ tone: "neutral", title: "Preview ready", message: "Browse files, then download the zip." });
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Failed to build scaffold preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadScaffold() {
    if (!result) return;
    setDownloading(true);
    setError(null);
    try {
      // If preview already built the zip, reuse it.
      if (previewZipBlob) {
        downloadBlob(previewZipBlob, "paper2product-starter.zip");
        toast.push({ tone: "good", title: "Downloaded", message: "Scaffold zip downloaded." });
        return;
      }
      const { blob } = await buildScaffoldZip();
      downloadBlob(blob, "paper2product-starter.zip");
      toast.push({ tone: "good", title: "Downloaded", message: "Scaffold zip downloaded." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to download scaffold.";
      setError(msg);
      toast.push({ tone: "bad", title: "Download failed", message: msg, durationMs: 4200 });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3 glow-ring">
            <div className="flex items-center gap-2">
              <Badge className="border-white/10 bg-gradient-to-r from-accent/20 via-accent2/15 to-accent3/15 text-text">
                Paper2Product AI
              </Badge>
              <Badge>Research → Runnable MVP</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Turn an arXiv paper into an implementation plan in minutes.
            </h1>
            <p className="text-muted max-w-2xl">
              Paste an arXiv link (or upload a PDF). We extract the methodology and generate a clean
              MVP scaffold: stack choices, endpoints, folder structure, and milestones.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-accent" />
                  <div className="font-medium">Analyze a paper</div>
                </div>
                <div className="flex rounded-xl border border-border bg-black/20 p-1">
                  <button
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs transition",
                      mode === "arxiv" ? "bg-white/10 text-text" : "text-muted hover:text-text"
                    )}
                    onClick={() => setMode("arxiv")}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5" /> arXiv URL
                    </span>
                  </button>
                  <button
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs transition",
                      mode === "pdf" ? "bg-white/10 text-text" : "text-muted hover:text-text"
                    )}
                    onClick={() => setMode("pdf")}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" /> PDF upload
                    </span>
                  </button>
                </div>
              </div>

              {mode === "arxiv" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="arxiv">arXiv link</Label>
                  <Input
                    id="arxiv"
                    value={arxivUrl}
                    onChange={(e) => setArxivUrl(e.target.value)}
                    placeholder="https://arxiv.org/abs/..."
                  />
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Preset</Label>
                      <select
                        className="w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/40"
                        value={presetKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          setPresetKey(key);
                          const p = presets.find((x) => x.key === key);
                          if (p) {
                            setArxivUrl(p.url);
                            toast.push({ tone: "neutral", title: "Preset", message: `Loaded: ${p.label}` });
                          }
                        }}
                      >
                        {presets.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Mode</Label>
                      <div className="flex rounded-xl border border-border bg-black/20 p-1">
                        <button
                          className={cn(
                            "flex-1 rounded-lg px-3 py-2 text-xs transition",
                            profile === "fast" ? "bg-white/10 text-text" : "text-muted hover:text-text"
                          )}
                          onClick={() => {
                            setProfile("fast");
                            toast.push({ tone: "neutral", title: "Demo mode", message: "Fast profile enabled." });
                          }}
                          type="button"
                        >
                          Fast
                        </button>
                        <button
                          className={cn(
                            "flex-1 rounded-lg px-3 py-2 text-xs transition",
                            profile === "quality" ? "bg-white/10 text-text" : "text-muted hover:text-text"
                          )}
                          onClick={() => {
                            setProfile("quality");
                            toast.push({ tone: "neutral", title: "Demo mode", message: "Quality profile enabled." });
                          }}
                          type="button"
                        >
                          Quality
                        </button>
                      </div>
                      <div className="text-xs text-muted">
                        {profile === "fast" ? (
                          <>
                            Quick demo: <span className="font-mono">{profileConfig.maxChars}</span> chars, eval off
                          </>
                        ) : (
                          <>
                            Better depth: <span className="font-mono">{profileConfig.maxChars}</span> chars, eval on
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Tip: both <span className="font-mono">/abs/</span> and{" "}
                    <span className="font-mono">/pdf/</span> links work.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pdf">PDF</Label>
                  <input
                    ref={fileRef}
                    id="pdf"
                    type="file"
                    accept="application/pdf"
                    className="block w-full cursor-pointer rounded-xl border border-border bg-black/30 px-3 py-2 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-text hover:file:bg-white/15"
                  />
                  <p className="text-xs text-muted">
                    We only extract a chunk for analysis (fast + cheap).
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={onAnalyze} disabled={!canSubmit}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                    </>
                  ) : (
                    <>
                      Generate plan <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button variant="ghost" type="button" disabled={!result || downloading} onClick={openPreview}>
                  <Download className="h-4 w-4" />
                  {downloading ? "Building…" : "Preview scaffold"}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={!result}
                  onClick={() => copy(json)}
                  title="Copy JSON"
                >
                  <Copy className="h-4 w-4" />
                  Copy result
                </Button>
              </div>

              {error ? (
                <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
                  {error}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-black/25 px-3 py-2 text-xs text-muted">
                Run the local Python service (see <span className="font-mono">hack01/README.md</span>) and configure{" "}
                <span className="font-mono">OUMI_SERVICE_URL</span> in{" "}
                <span className="font-mono">hack01/.env.local</span>. For a free local model, set{" "}
                <span className="font-mono">OLLAMA_BASE_URL</span> / <span className="font-mono">OLLAMA_MODEL</span>.
              </div>
            </Card>

            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Output</div>
                {result?.paper?.source ? (
                  <div className="flex items-center gap-2">
                    {typeof result.evaluation?.coverage_score === "number" ? (
                      <Badge tone={result.evaluation.coverage_score >= 0.75 ? "good" : "neutral"}>
                        Faithfulness {(result.evaluation.coverage_score * 100).toFixed(0)}%
                      </Badge>
                    ) : null}
                    <Badge tone="good">
                      {result.paper.source === "arxiv" ? "arXiv" : "PDF"} •{" "}
                      {result.paper.extractedChars.toLocaleString()} chars
                    </Badge>
                  </div>
                ) : (
                  <Badge>Waiting</Badge>
                )}
              </div>
              {result?.paper?.title ? (
                <div className="text-sm text-text">
                  <span className="text-muted">Title:</span> {result.paper.title}
                </div>
              ) : null}

              {!result ? (
                busy ? (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-border bg-black/30 p-4 animate-fadeInUp">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Pipeline</div>
                        <Badge>Running…</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Skeleton className="h-[54px]" />
                        <Skeleton className="h-[54px]" />
                        <Skeleton className="h-[54px]" />
                        <Skeleton className="h-[54px]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Skeleton className="h-[86px]" />
                      <Skeleton className="h-[86px]" />
                    </div>
                    <Skeleton className="h-[110px]" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Skeleton className="h-[86px]" />
                      <Skeleton className="h-[86px]" />
                    </div>
                    <Skeleton className="h-[280px]" />
                  </div>
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col justify-center gap-2 rounded-xl border border-border bg-black/30 px-5 py-10">
                    <div className="text-sm text-text">Run an analysis to see structured output.</div>
                    <div className="text-xs text-muted">
                      You’ll get a summary + a practical engineering plan you can immediately scaffold.
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-4 animate-fadeInUp">
                  <div className="rounded-xl border border-border bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Pipeline</div>
                      <div className="flex items-center gap-2">
                        {result.meta?.service?.engine ? <Badge>{result.meta.service.engine}</Badge> : null}
                        {result.meta?.service?.model ? <Badge>{result.meta.service.model}</Badge> : null}
                        {typeof result.meta?.total_ms === "number" ? (
                          <Badge tone="good">{ms(result.meta.total_ms)}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-border bg-black/20 p-3">
                        <SectionTitle>Download</SectionTitle>
                        <div className="mt-1 text-sm">{ms(result.meta?.download_ms)}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-black/20 p-3">
                        <SectionTitle>Extract</SectionTitle>
                        <div className="mt-1 text-sm">{ms(result.meta?.extract_ms)}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-black/20 p-3">
                        <SectionTitle>Plan</SectionTitle>
                        <div className="mt-1 text-sm">{ms(result.meta?.service?.generate_ms)}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-black/20 p-3">
                        <SectionTitle>Eval</SectionTitle>
                        <div className="mt-1 text-sm">
                          {result.meta?.service?.eval_enabled === false ? "off" : ms(result.meta?.service?.eval_ms)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted">
                      Want faster runs? Set <span className="font-mono">ENABLE_EVAL=0</span> and{" "}
                      <span className="font-mono">MAX_EXTRACT_CHARS=3000</span>.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <div className="text-xs text-muted">Problem</div>
                      <div className="mt-1 text-sm">{result.understanding.problem}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <div className="text-xs text-muted">Methodology</div>
                      <div className="mt-1 text-sm">{result.understanding.methodology}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-black/30 p-4">
                    <SectionTitle>Architecture</SectionTitle>
                    <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">
                      {result.understanding.architecture.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <div className="text-xs text-muted">Inputs</div>
                      <div className="mt-1 text-sm">{result.understanding.inputs}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <div className="text-xs text-muted">Outputs</div>
                      <div className="mt-1 text-sm">{result.understanding.outputs}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-black/30 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Practical engineering plan</div>
                        <Button variant="ghost" onClick={() => copy(JSON.stringify(result.implementationPlan, null, 2))}>
                          <Copy className="h-4 w-4" />
                          Copy JSON
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border bg-black/30 p-4">
                          <SectionTitle>Stack</SectionTitle>
                          <ul className="mt-2 grid gap-1 text-sm">
                            <li>
                              <span className="text-muted">Frontend:</span> {result.implementationPlan.stack.frontend}
                            </li>
                            <li>
                              <span className="text-muted">Backend:</span> {result.implementationPlan.stack.backend}
                            </li>
                            {result.implementationPlan.stack.orchestration ? (
                              <li>
                                <span className="text-muted">Orchestration:</span>{" "}
                                {result.implementationPlan.stack.orchestration}
                              </li>
                            ) : null}
                            {result.implementationPlan.stack.evaluation ? (
                              <li>
                                <span className="text-muted">Evaluation:</span> {result.implementationPlan.stack.evaluation}
                              </li>
                            ) : null}
                          </ul>
                        </div>

                        <div className="rounded-xl border border-border bg-black/30 p-4">
                          <SectionTitle>Milestones</SectionTitle>
                          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm">
                            {result.implementationPlan.milestones.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-black/30 p-4">
                        <SectionTitle>API endpoints</SectionTitle>
                        {result.implementationPlan.apiEndpoints.length ? (
                          <ul className="mt-2 grid gap-2 text-sm">
                            {result.implementationPlan.apiEndpoints.map((e) => (
                              <li
                                key={`${e.method}-${e.path}`}
                                className="rounded-lg border border-border bg-black/20 px-3 py-2 cursor-pointer hover:bg-white/5"
                                onClick={() => setSelectedEndpoint(e)}
                                role="button"
                                tabIndex={0}
                              >
                                <div className="font-mono text-xs text-muted">
                                  {e.method.toUpperCase()} {e.path}
                                </div>
                                <div className="mt-1">{e.purpose}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-2 text-sm text-muted">No endpoints returned.</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-black/30 p-4">
                        <SectionTitle>Folder structure</SectionTitle>
                        <div className="mt-2">
                          <TreeView node={tree} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {result.evaluation ? (
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <div className="text-xs text-muted">Oumi evaluation (JSON)</div>
                      <div className="mt-3">
                        <CodeBlock value={JSON.stringify(result.evaluation, null, 2)} />
                      </div>
                    </div>
                  ) : null}

                  {result.notes?.length ? (
                    <div className="rounded-xl border border-border bg-black/30 p-4">
                      <SectionTitle>Notes</SectionTitle>
                      <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-muted">
                        {result.notes.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <details className="rounded-xl border border-border bg-black/30 p-4">
                    <summary className="cursor-pointer text-sm text-muted">Debug: raw JSON</summary>
                    <div className="mt-3">
                      <CodeBlock value={json} />
                    </div>
                  </details>
                </div>
              )}
            </Card>
          </div>

          <footer className="text-xs text-muted">
            Built for hack01: minimal UI, real extraction, plan output + evaluation layer (Oumi-style).
          </footer>
        </div>
      </div>

      {selectedEndpoint ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 animate-fadeInUp" onClick={() => setSelectedEndpoint(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-panel/95 backdrop-blur p-5 shadow-soft animate-slideInRight">
            <div className="flex items-center justify-between">
              <div className="font-medium">Endpoint</div>
              <Button variant="ghost" onClick={() => setSelectedEndpoint(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-black/30 p-4">
              <div className="font-mono text-xs text-muted">
                {selectedEndpoint.method.toUpperCase()} {selectedEndpoint.path}
              </div>
              <div className="mt-2 text-sm">{selectedEndpoint.purpose}</div>
            </div>
            <div className="mt-4">
              <SectionTitle>Suggested payload</SectionTitle>
              <div className="mt-2">
                <CodeBlock value={JSON.stringify({ example: "TODO: add payload details" }, null, 2)} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 animate-fadeInUp"
            onClick={() => {
              setPreviewOpen(false);
              setPreviewError(null);
            }}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(1100px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
            <Card className="p-0 overflow-hidden animate-scaleIn">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="font-medium">Scaffold preview</div>
                  {previewBusy ? <Badge>Building…</Badge> : null}
                  {previewFiles.length ? <Badge>{previewFiles.length} files</Badge> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" disabled={!previewZipBlob || downloading} onClick={downloadScaffold}>
                    <Download className="h-4 w-4" />
                    Download .zip
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPreviewOpen(false);
                      setPreviewError(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
                <div className="border-r border-border bg-black/20 p-3 max-h-[70vh] overflow-auto">
                  {previewError ? (
                    <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
                      {previewError}
                    </div>
                  ) : null}

                  {previewBusy ? (
                    <div className="p-3 text-sm text-muted">Building scaffold preview…</div>
                  ) : previewFiles.length ? (
                    <div className="grid gap-1">
                      {previewFiles.map((p) => (
                        <button
                          key={p}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left text-xs font-mono transition",
                            "border border-transparent hover:bg-white/5",
                            previewSelected === p && "bg-white/5 border-border"
                          )}
                          onClick={async () => {
                            setPreviewSelected(p);
                            await ensurePreviewFile(p);
                          }}
                          type="button"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-muted">No files yet.</div>
                  )}
                </div>

                <div className="p-5 max-h-[70vh] overflow-auto">
                  {!previewSelected ? (
                    <div className="text-sm text-muted">Select a file to preview.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-mono text-muted">{previewSelected}</div>
                        <Button
                          variant="ghost"
                          disabled={!previewContent[previewSelected]}
                          onClick={() => copy(previewContent[previewSelected] || "")}
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                      <CodeBlock value={previewContent[previewSelected] || "Loading…"} />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </main>
  );
}


