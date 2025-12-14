export function arxivIdFromUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (!u.hostname.includes("arxiv.org")) return null;

    // Supported:
    // - https://arxiv.org/abs/1706.03762
    // - https://arxiv.org/abs/1706.03762v5
    // - https://arxiv.org/pdf/1706.03762.pdf
    // - https://arxiv.org/pdf/1706.03762v5.pdf
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const kind = parts[0];
    let id = parts[1];
    if (kind !== "abs" && kind !== "pdf") return null;
    if (id.endsWith(".pdf")) id = id.slice(0, -4);
    return id || null;
  } catch {
    return null;
  }
}

export function arxivPdfUrl(arxivId: string): string {
  return `https://arxiv.org/pdf/${arxivId}.pdf`;
}


