/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Copy, Download, FileText, Link2, Loader2, Wand2 } from "lucide-react";
import { Badge, Button, Card, Input, Label, cn } from "@/components/ui";

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

export default function HomePage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"arxiv" | "pdf">("arxiv");
  const [arxivUrl, setArxivUrl] = useState("https://arxiv.org/abs/1706.03762");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (mode === "arxiv") return arxivUrl.trim().length > 0;
    return Boolean(fileRef.current?.files?.[0]);
  }, [mode, arxivUrl, busy]);

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

      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const body = (await res.json()) as { ok: boolean; error?: string; data?: AnalyzeResult };
      if (!res.ok || !body.ok || !body.data) throw new Error(body.error || "Failed to analyze.");
      setResult(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const json = useMemo(() => (result ? JSON.stringify(result, null, 2) : ""), [result]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function downloadScaffold() {
    if (!result) return;
    setDownloading(true);
    setError(null);
    try {
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "paper2product-starter.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download scaffold.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge className="border-accent/30 bg-accent/10 text-accent">Paper2Product AI</Badge>
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
                <Button variant="ghost" type="button" disabled={!result || downloading} onClick={downloadScaffold}>
                  <Download className="h-4 w-4" />
                  {downloading ? "Building…" : "Download scaffold"}
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
                <div className="flex h-full min-h-[320px] flex-col justify-center gap-2 rounded-xl border border-border bg-black/30 px-5 py-10">
                  <div className="text-sm text-text">Run an analysis to see structured output.</div>
                  <div className="text-xs text-muted">
                    You’ll get a summary + a practical engineering plan you can immediately scaffold.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
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
                              <li key={`${e.method}-${e.path}`} className="rounded-lg border border-border bg-black/20 px-3 py-2">
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
                          <CodeBlock value={(result.implementationPlan.folderStructure || []).join("\n") || "(empty)"} />
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
                </div>
              )}
            </Card>
          </div>

          <footer className="text-xs text-muted">
            Built for hack01: minimal UI, real extraction, plan output + evaluation layer (Oumi-style).
          </footer>
        </div>
      </div>
    </main>
  );
}


