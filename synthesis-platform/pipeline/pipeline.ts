/**
 * Upload → Analyze → Recommend → Execute
 *
 * Typed pseudo-code outline of the end-to-end pipeline. Each stage is a pure
 * function that takes a session context and returns an updated one, so the
 * pipeline can be driven by a durable workflow engine (Inngest / Temporal).
 */

// ───────────────────────── Types ─────────────────────────

export type Modality = "text" | "audio" | "image" | "doc";

export interface UploadedBlob {
  id: string;
  name: string;
  mimetype: string;
  bytes: number;
  storageKey: string; // S3 / R2 object key
  sha256: string;
}

export interface ParsedChunk {
  blobId: string;
  modality: Modality;
  text: string; // transcribed / OCR'd / extracted
  embedding?: number[];
  metadata: Record<string, unknown>;
}

export interface Goal {
  id: string;
  title: string;
  summary: string;
  confidence: number; // 0..1
  supportingChunkIds: string[];
}

export interface AppIdea {
  id: string;
  name: string;
  tagline: string;
  stack: string[];
  effort: "S" | "M" | "L";
  match: number;
  linkedGoalIds: string[];
}

export interface BuildArtifact {
  repoUrl: string;
  previewUrl: string;
  logsStreamUrl: string;
}

export interface SessionContext {
  sessionId: string;
  userId: string;
  blobs: UploadedBlob[];
  chunks: ParsedChunk[];
  goals: Goal[];
  apps: AppIdea[];
  selectedAppId?: string;
  artifact?: BuildArtifact;
}

// ─────────────────────── 1. Upload ───────────────────────

/**
 * Client streams each file via a resumable tus upload straight to object
 * storage. The server only mediates: issues signed URLs, records metadata,
 * fans out parse jobs.
 */
export async function ingest(
  ctx: SessionContext,
  files: File[],
  deps: {
    createSignedUpload: (f: File) => Promise<{ storageKey: string; putUrl: string }>;
    putResumable: (putUrl: string, f: File) => Promise<{ sha256: string }>;
    enqueueParse: (blob: UploadedBlob) => Promise<void>;
  },
): Promise<SessionContext> {
  const blobs: UploadedBlob[] = [];
  for (const f of files) {
    const { storageKey, putUrl } = await deps.createSignedUpload(f);
    const { sha256 } = await deps.putResumable(putUrl, f);
    const blob: UploadedBlob = {
      id: crypto.randomUUID(),
      name: f.name,
      mimetype: f.type || "application/octet-stream",
      bytes: f.size,
      storageKey,
      sha256,
    };
    blobs.push(blob);
    await deps.enqueueParse(blob);
  }
  return { ...ctx, blobs: [...ctx.blobs, ...blobs] };
}

// ─────────────────────── 2. Analyze ──────────────────────

/**
 * Router picks a parser per modality, extracts text, embeds, and persists.
 */
export async function analyze(
  ctx: SessionContext,
  deps: {
    parseDoc: (b: UploadedBlob) => Promise<ParsedChunk[]>; // pdfplumber / Unstructured
    transcribeAudio: (b: UploadedBlob) => Promise<ParsedChunk[]>; // Whisper via Groq
    captionImage: (b: UploadedBlob) => Promise<ParsedChunk[]>; // Claude vision + CLIP
    parseText: (b: UploadedBlob) => Promise<ParsedChunk[]>;
    embed: (text: string) => Promise<number[]>; // text-embedding-3-large
    upsertVectors: (chunks: ParsedChunk[]) => Promise<void>; // pgvector
  },
): Promise<SessionContext> {
  const parsed: ParsedChunk[] = [];
  for (const blob of ctx.blobs) {
    const mod = routeModality(blob.mimetype);
    const chunks =
      mod === "audio"
        ? await deps.transcribeAudio(blob)
        : mod === "image"
          ? await deps.captionImage(blob)
          : mod === "doc"
            ? await deps.parseDoc(blob)
            : await deps.parseText(blob);
    for (const c of chunks) c.embedding = await deps.embed(c.text);
    parsed.push(...chunks);
  }
  await deps.upsertVectors(parsed);
  return { ...ctx, chunks: [...ctx.chunks, ...parsed] };
}

/**
 * Synthesis step: Claude Opus reads a curated, deduplicated view of the
 * chunks and returns structured goals. We ask for JSON with a schema and
 * validate on arrival — never trust free-form output for downstream stages.
 */
export async function synthesizeGoals(
  ctx: SessionContext,
  deps: {
    pickRepresentativeChunks: (chunks: ParsedChunk[]) => ParsedChunk[];
    callOpus: (prompt: string) => Promise<{ goals: Goal[] }>;
  },
): Promise<SessionContext> {
  const corpus = deps
    .pickRepresentativeChunks(ctx.chunks)
    .map((c) => `[${c.modality}:${c.blobId}] ${c.text}`)
    .join("\n\n");
  const prompt = renderSynthesisPrompt(corpus);
  const { goals } = await deps.callOpus(prompt);
  return { ...ctx, goals };
}

// ────────────────────── 3. Recommend ─────────────────────

export async function recommendApps(
  ctx: SessionContext,
  deps: {
    callSonnet: (prompt: string) => Promise<{ apps: AppIdea[] }>;
  },
): Promise<SessionContext> {
  const prompt = renderRecommendationPrompt(ctx.goals);
  const { apps } = await deps.callSonnet(prompt);
  return { ...ctx, apps };
}

// ─────────────────────── 4. Execute ──────────────────────

/**
 * Autonomous build runs inside a sandbox (E2B / Firecracker microVM). The
 * worker streams stdout back to the client via SSE so the dashboard updates
 * step-by-step.
 */
export async function executeApp(
  ctx: SessionContext,
  appId: string,
  deps: {
    spawnSandbox: () => Promise<{ id: string; exec: (cmd: string) => Promise<string> }>;
    agentRun: (sandboxId: string, goal: AppIdea) => AsyncIterable<string>; // Claude Agent SDK
    publishPreview: (sandboxId: string) => Promise<BuildArtifact>;
  },
): Promise<SessionContext> {
  const app = ctx.apps.find((a) => a.id === appId);
  if (!app) throw new Error(`app ${appId} not in session`);
  const sandbox = await deps.spawnSandbox();
  for await (const _log of deps.agentRun(sandbox.id, app)) {
    // Streamed to client via SSE channel keyed on sessionId.
  }
  const artifact = await deps.publishPreview(sandbox.id);
  return { ...ctx, selectedAppId: appId, artifact };
}

// ─────────────────────── Helpers ─────────────────────────

function routeModality(mime: string): Modality {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/markdown" || mime === "text/plain") return "text";
  return "doc";
}

function renderSynthesisPrompt(corpus: string): string {
  return [
    "You are the synthesis engine of an autonomous app-building workstation.",
    "Read the user's mixed-modality corpus below and extract 3–5 overarching goals.",
    "Return STRICT JSON: { goals: Array<{id,title,summary,confidence,supportingChunkIds}> }.",
    "Confidence reflects evidence strength across multiple sources, not a single file.",
    "",
    "---CORPUS---",
    corpus,
  ].join("\n");
}

function renderRecommendationPrompt(goals: Goal[]): string {
  return [
    "Given these synthesized goals, recommend 3 concrete apps the user should build.",
    "Prioritize ideas that cover multiple goals with one codebase.",
    "Return STRICT JSON: { apps: Array<{id,name,tagline,stack,effort,match,linkedGoalIds}> }.",
    "Effort is S/M/L (hours/days/weeks). Match is 0..1 alignment to the goals.",
    "",
    "---GOALS---",
    JSON.stringify(goals, null, 2),
  ].join("\n");
}

// ───────────────────── Orchestration ─────────────────────

/**
 * End-to-end driver. In production each call is a durable step in Inngest /
 * Temporal so retries, timeouts, and partial progress survive crashes.
 */
export async function runPipeline(
  initial: SessionContext,
  files: File[],
  deps: Parameters<typeof ingest>[2] &
    Parameters<typeof analyze>[1] &
    Parameters<typeof synthesizeGoals>[1] &
    Parameters<typeof recommendApps>[1],
): Promise<SessionContext> {
  let ctx = await ingest(initial, files, deps);
  ctx = await analyze(ctx, deps);
  ctx = await synthesizeGoals(ctx, deps);
  ctx = await recommendApps(ctx, deps);
  return ctx; // execution is user-triggered from the dashboard
}
