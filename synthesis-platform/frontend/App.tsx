import React, { useCallback, useMemo, useRef, useState } from "react";

/**
 * AI-Powered Synthesis & Autonomous Execution Platform
 *
 * Single-file React component covering:
 *   • Landing page — universal drop-zone
 *   • Dashboard   — synthesized goals, recommended apps, autonomous build
 *
 * Drop-in: requires Tailwind CSS (dark mode enabled) in the host app.
 * State is self-contained; replace the `mock*` helpers with real API calls.
 */

type Stage = "idle" | "uploading" | "analyzing" | "ready" | "executing";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  kind: "doc" | "audio" | "image" | "note" | "other";
  progress: number;
};

type Goal = {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  signals: string[];
};

type AppIdea = {
  id: string;
  name: string;
  tagline: string;
  stack: string[];
  effort: "S" | "M" | "L";
  match: number;
};

type BuildStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
};

const classifyKind = (name: string): UploadedFile["kind"] => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a", "flac", "ogg"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["md", "txt", "rtf"].includes(ext)) return "note";
  if (["pdf", "docx", "pptx", "xlsx", "csv"].includes(ext)) return "doc";
  return "other";
};

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

// Replace with fetch("/api/synthesize") — shaped to match the pipeline module.
const mockSynthesize = (files: UploadedFile[]): Promise<{ goals: Goal[]; apps: AppIdea[] }> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        goals: [
          {
            id: "g1",
            title: "Ship a personal knowledge OS",
            summary:
              "Recurring references to Zettelkasten-style notes, tagging systems, and voice-memo capture suggest you want a unified second-brain.",
            confidence: 0.92,
            signals: ["8 markdown notes", "3 voice memos", "PDF: ‘Building a Second Brain’"],
          },
          {
            id: "g2",
            title: "Automate creative production",
            summary:
              "Screenshots of Figma frames plus scripts in your notes point to a pipeline that turns drafts into shippable assets.",
            confidence: 0.78,
            signals: ["12 design screenshots", "2 scripts: ffmpeg, sharp"],
          },
          {
            id: "g3",
            title: "Teach what you learn",
            summary:
              "Long-form essays and lesson outlines indicate an intent to publish or teach — likely a course or newsletter.",
            confidence: 0.64,
            signals: ["3 outlines", "newsletter drafts"],
          },
        ],
        apps: [
          {
            id: "a1",
            name: "Atlas",
            tagline: "Capture anywhere, synthesize nightly, recall instantly.",
            stack: ["Next.js", "pgvector", "Claude", "Whisper"],
            effort: "M",
            match: 0.94,
          },
          {
            id: "a2",
            name: "Forge",
            tagline: "Draft → design → export pipeline for creators.",
            stack: ["Remix", "FFmpeg", "Sharp", "S3"],
            effort: "L",
            match: 0.81,
          },
          {
            id: "a3",
            name: "Lumen",
            tagline: "Turn your notes into a serialized course.",
            stack: ["Astro", "MDX", "Stripe"],
            effort: "S",
            match: 0.72,
          },
        ],
      });
    }, 1800);
  });

const buildPlan = (idea: AppIdea): BuildStep[] => [
  { id: "s1", label: `Scaffold ${idea.name} repo (${idea.stack[0]})`, status: "pending" },
  { id: "s2", label: "Generate data model & API routes", status: "pending" },
  { id: "s3", label: "Design system: dark theme + primitives", status: "pending" },
  { id: "s4", label: "Wire Claude synthesis endpoint", status: "pending" },
  { id: "s5", label: "Write tests · typecheck · preview deploy", status: "pending" },
];

export default function App() {
  const [stage, setStage] = useState<Stage>("idle");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [apps, setApps] = useState<AppIdea[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppIdea | null>(null);
  const [steps, setSteps] = useState<BuildStep[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    const next: UploadedFile[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      kind: classifyKind(f.name),
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...next]);
    setStage("uploading");
    // Simulated resumable upload progress. Swap with tus-js-client in prod.
    for (let p = 10; p <= 100; p += 10) {
      await new Promise((r) => setTimeout(r, 60));
      setFiles((prev) => prev.map((f) => (next.find((n) => n.id === f.id) ? { ...f, progress: p } : f)));
    }
    setStage("analyzing");
    const { goals, apps } = await mockSynthesize(next);
    setGoals(goals);
    setApps(apps);
    setStage("ready");
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) ingest(e.dataTransfer.files);
  };

  const startExecution = async (idea: AppIdea) => {
    setSelectedApp(idea);
    const plan = buildPlan(idea);
    setSteps(plan);
    setStage("executing");
    for (const step of plan) {
      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: "running" } : s)));
      await new Promise((r) => setTimeout(r, 900));
      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: "done" } : s)));
    }
  };

  const reset = () => {
    setStage("idle");
    setFiles([]);
    setGoals([]);
    setApps([]);
    setSelectedApp(null);
    setSteps([]);
  };

  const showDashboard = stage === "ready" || stage === "executing" || stage === "analyzing";

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 antialiased selection:bg-indigo-500/40">
      <Ambient />
      <Header onReset={reset} hasSession={stage !== "idle"} />
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        {!showDashboard ? (
          <Landing
            stage={stage}
            dragOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onPick={() => inputRef.current?.click()}
            inputRef={inputRef}
            onFiles={(fs) => ingest(fs)}
            files={files}
          />
        ) : (
          <Dashboard
            stage={stage}
            files={files}
            goals={goals}
            apps={apps}
            selectedApp={selectedApp}
            steps={steps}
            onExecute={startExecution}
            onAddMore={() => inputRef.current?.click()}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </main>
    </div>
  );
}

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="absolute bottom-[-15%] right-[-10%] h-[500px] w-[700px] rounded-full bg-fuchsia-600/10 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

function Header({ onReset, hasSession }: { onReset: () => void; hasSession: boolean }) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-[11px] font-black text-black">
          S
        </div>
        <div className="text-sm font-semibold tracking-tight">
          Synthesis<span className="text-zinc-500">.ai</span>
        </div>
      </div>
      <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
        <a className="hover:text-zinc-200" href="#">Docs</a>
        <a className="hover:text-zinc-200" href="#">Pricing</a>
        <a className="hover:text-zinc-200" href="#">Changelog</a>
      </nav>
      <div className="flex items-center gap-2">
        {hasSession && (
          <button
            onClick={onReset}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            New session
          </button>
        )}
        <button className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white">
          Sign in
        </button>
      </div>
    </header>
  );
}

function Landing(props: {
  stage: Stage;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFiles: (fs: FileList) => void;
  files: UploadedFile[];
}) {
  const { stage, dragOver, onDragOver, onDragLeave, onDrop, onPick, files } = props;
  const busy = stage !== "idle";

  return (
    <section className="pt-10 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[11px] uppercase tracking-widest text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Autonomous workstation
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
          Drop in your chaos.
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">
            Leave with a built app.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Upload any notes, voice memos, screenshots, or documents. Synthesis reads between them,
          finds the app you have been trying to build, and starts coding it.
        </p>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !busy && onPick()}
        role="button"
        tabIndex={0}
        className={[
          "group relative mx-auto mt-10 flex max-w-3xl cursor-pointer flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center transition",
          dragOver
            ? "border-indigo-400/60 bg-indigo-500/5 ring-1 ring-indigo-400/40"
            : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40",
        ].join(" ")}
      >
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-inner">
          <UploadGlyph />
        </div>
        <div className="mt-5 text-base font-medium text-zinc-100">
          {busy ? "Processing your upload…" : "Drop files, or click to browse"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Notes · PDF · DOCX · Audio · Images · Markdown · up to 2 GB per file
        </div>

        {!!files.length && (
          <ul className="mt-8 grid w-full max-w-xl gap-2 text-left">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2"
              >
                <KindBadge kind={f.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-zinc-200">{f.name}</div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded bg-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400 transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-[10px] tabular-nums text-zinc-500">{fmtBytes(f.size)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { k: "01", t: "Ingest", d: "Multi-modal, resumable, up to 2 GB." },
          { k: "02", t: "Synthesize", d: "Claude extracts goals across files." },
          { k: "03", t: "Execute", d: "Sandboxed agents draft the app." },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="text-[10px] tracking-widest text-zinc-500">{s.k}</div>
            <div className="mt-1 text-sm font-medium text-zinc-100">{s.t}</div>
            <div className="mt-1 text-xs text-zinc-400">{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard(props: {
  stage: Stage;
  files: UploadedFile[];
  goals: Goal[];
  apps: AppIdea[];
  selectedApp: AppIdea | null;
  steps: BuildStep[];
  onExecute: (idea: AppIdea) => void;
  onAddMore: () => void;
}) {
  const { stage, files, goals, apps, selectedApp, steps, onExecute, onAddMore } = props;
  const analyzing = stage === "analyzing";

  return (
    <section className="pt-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-zinc-500">Workspace</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            What you are trying to build
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={[
                "h-1.5 w-1.5 rounded-full",
                analyzing ? "animate-pulse bg-amber-400" : "bg-emerald-400",
              ].join(" ")}
            />
            {analyzing ? "Synthesizing…" : "Synthesis complete"}
          </span>
          <button
            onClick={onAddMore}
            className="rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
          >
            Add files
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Sources" count={files.length}>
          <ul className="divide-y divide-zinc-900">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <KindBadge kind={f.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-zinc-200">{f.name}</div>
                  <div className="text-[10px] text-zinc-500">{fmtBytes(f.size)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Synthesized goals"
          count={goals.length || (analyzing ? undefined : 0)}
        >
          {analyzing ? (
            <SkeletonGoals />
          ) : (
            <div className="grid gap-3">
              {goals.map((g) => (
                <article
                  key={g.id}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-4 transition hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-medium text-zinc-100">{g.title}</h3>
                    <Confidence value={g.confidence} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{g.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {g.signals.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Recommended apps" count={apps.length || (analyzing ? undefined : 0)}>
          {analyzing ? (
            <SkeletonApps />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((a) => (
                <div
                  key={a.id}
                  className="group relative flex flex-col rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/70 to-zinc-950/20 p-4 transition hover:border-indigo-500/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{a.name}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">{a.tagline}</div>
                    </div>
                    <EffortBadge effort={a.effort} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.stack.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                      match {(a.match * 100).toFixed(0)}%
                    </div>
                    <button
                      onClick={() => onExecute(a)}
                      className="rounded-md bg-indigo-500/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400"
                    >
                      Autonomous build →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {selectedApp && (
        <div className="mt-6">
          <Panel title={`Building · ${selectedApp.name}`}>
            <ol className="grid gap-2">
              {steps.map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-xs text-zinc-200">{s.label}</span>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 backdrop-blur-sm",
        className ?? "",
      ].join(" ")}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-zinc-500">{title}</h3>
        {typeof count === "number" && (
          <span className="rounded-md border border-zinc-800 bg-zinc-900/70 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function KindBadge({ kind }: { kind: UploadedFile["kind"] }) {
  const map: Record<UploadedFile["kind"], { label: string; cls: string }> = {
    doc: { label: "DOC", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
    audio: { label: "WAV", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
    image: { label: "IMG", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    note: { label: "MD", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    other: { label: "FILE", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
  };
  const { label, cls } = map[kind];
  return (
    <span
      className={`grid h-7 w-10 place-items-center rounded-md border text-[9px] font-bold tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-indigo-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-zinc-400">{pct}%</span>
    </div>
  );
}

function EffortBadge({ effort }: { effort: "S" | "M" | "L" }) {
  const map = {
    S: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    M: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    L: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  } as const;
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${map[effort]}`}
    >
      {effort}
    </span>
  );
}

function StatusPill({ status }: { status: BuildStep["status"] }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> done
      </span>
    );
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" /> running
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> queued
    </span>
  );
}

function SkeletonGoals() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-4">
          <div className="h-3 w-40 animate-pulse rounded bg-zinc-800/80" />
          <div className="mt-2 h-2 w-full animate-pulse rounded bg-zinc-800/60" />
          <div className="mt-1 h-2 w-3/4 animate-pulse rounded bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}

function SkeletonApps() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-950/50" />
      ))}
    </div>
  );
}

function UploadGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}
