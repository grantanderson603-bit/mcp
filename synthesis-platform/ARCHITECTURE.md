# AI-Powered Synthesis & Autonomous Execution Platform

## 1. Architecture Overview

A four-plane architecture keeps the "low-latency AI workstation" feel while
absorbing the heavy lifting of multi-modal ingestion and code generation.

```
  ┌──────────────────────── Client Plane ────────────────────────┐
  │  React 18 + Vite + TypeScript + Tailwind (dark)              │
  │  TanStack Query · Zustand · Framer Motion · shadcn/ui        │
  │  Streamed responses via fetch + ReadableStream (SSE)         │
  └──────────────────────────────────────────────────────────────┘
                          │  HTTPS / SSE / WS
  ┌──────────────────── API / Edge Plane ────────────────────────┐
  │  Next.js Route Handlers (edge) + Hono on Cloudflare Workers  │
  │  Resumable uploads (tus) → S3 / R2 · Signed URLs             │
  │  Auth: Clerk / Auth.js · Rate limit: Upstash Redis           │
  └──────────────────────────────────────────────────────────────┘
                          │  Job enqueue
  ┌────────────────── Synthesis / Worker Plane ──────────────────┐
  │  Python workers on Modal / Fly Machines (GPU optional)       │
  │  · File routing       → mimetype dispatcher                  │
  │  · OCR / docs         → Unstructured, pdfplumber, Tesseract  │
  │  · Audio              → Whisper (Groq) / Deepgram            │
  │  · Images             → CLIP embeddings + Claude vision      │
  │  · Text / Notes       → Markdown + code-aware splitters      │
  │  Embeddings: text-embedding-3-large → pgvector (Postgres)    │
  │  Synthesis LLM: Claude Opus 4.7 (reasoning + long context)   │
  │  Recommendation LLM: Claude Sonnet 4.6 (structured output)   │
  │  Orchestration: Inngest / Temporal for durable multi-step    │
  └──────────────────────────────────────────────────────────────┘
                          │  Artifacts
  ┌──────────────── Autonomous Execution Plane ──────────────────┐
  │  Claude Agent SDK sandboxes (Firecracker microVMs / E2B)     │
  │  Per-project git repo scaffold, tests, typecheck, preview    │
  │  Streaming build logs → client over SSE                      │
  │  Artifacts stored in S3; preview via ephemeral subdomain     │
  └──────────────────────────────────────────────────────────────┘

  Storage: Postgres (metadata + pgvector) · S3/R2 (blobs) · Redis (queues)
  Observability: OpenTelemetry → Grafana Tempo/Loki · Sentry · PostHog
```

### Why this stack
- **Next.js + edge route handlers** keep the landing page instant and allow
  SSE streaming for the dashboard without a separate WS server.
- **Tus resumable uploads** matter because "any file type" includes large
  audio/video; the drop-zone stays premium even on flaky mobile networks.
- **pgvector inside Postgres** avoids a second database for retrieval — one
  connection, one backup story.
- **Claude Opus 4.7** is used for the synthesis step because the goal-
  extraction quality dominates the end-to-end UX; Sonnet handles the cheaper
  recommendation and scaffolding steps.
- **Sandboxed agent SDK** isolates the autonomous codegen so a bad plan
  cannot damage shared infra — each project runs in a throwaway microVM.

## 2. Deliverables

- `frontend/App.tsx` — single-file React component (landing + dashboard)
- `pipeline/pipeline.ts` — typed outline of the Upload→Analyze→Recommend→Execute flow
- `pipeline/prompts.md` — the synthesis + recommendation prompts
