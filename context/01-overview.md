# 1. Overview

## What sraww is

sraww is a local, single-user whiteboard built on the Excalidraw editor. It runs on the owner's own computer.

It has five parts:

- **Drawings.** Create, open, rename, duplicate, delete and import `.excalidraw` files. Autosave. Export PNG, SVG or `.excalidraw`.
- **Assistant.** A prompt box on an open drawing. It can edit the drawing, make a whole new diagram from a sentence, or explain the selected shapes.
- **Architecture maps.** Scan a code folder (TypeScript and JavaScript only) and draw how its folders depend on each other. It also lists structural findings (cycles, orphans, hubs, large folders, deep nesting), can run an AI review over those findings, and can name folders with AI.
- **Learn.** Type a topic. The AI drafts a course of modules and topics. Opening a topic builds a lesson: a diagram drawn step by step, an explanation, key terms and checked web sources.
- **Math.** Insert LaTeX formulas as images, and insert axes, a number line and tables from the editor.

Supporting parts: a code-project intake (upload a folder or zip, or import a public GitHub branch), a shape library, a first-visit tour, and an AI tools page.

## The core constraint

There are no API keys and no accounts. The AI runs by starting the owner's already-logged-in **Claude Code** (`claude`, Claude Pro) and **Codex** (`codex`, ChatGPT Plus) command-line tools. The app holds no credentials. The privacy policy is in `PRIVACY.md`.

## Stack

| Part | Choice |
| --- | --- |
| Editor | `@excalidraw/excalidraw` 0.18.0, pinned exactly |
| Client | React 19, TypeScript 5.9 (strict), Vite 8 |
| Server | Node 22.9 or newer, Express 5, zod 4, TypeScript run by `tsx` |
| Layout | `elkjs` 0.12 (automatic box layout for diagrams and architecture maps) |
| Formulas | `mathjax` 4 on the server (LaTeX to SVG) |
| Archives | `fflate` (zip upload and GitHub zip download) |
| Tests | Vitest 5 with jsdom and Testing Library (unit and component), Playwright (browser), supertest (server routes) |
| Quality | ESLint 9 (flat config), Prettier 3 |

## Running it

```bash
npm install                # also copies Excalidraw fonts into public/fonts
npm run dev                # editor on http://127.0.0.1:5173, API on port 4317
npm run build && npm start # production build, served by the Express server
```

The server binds to `127.0.0.1` only. It rejects requests whose Host or Origin headers are not local. Environment variables are listed in [02-architecture.md](02-architecture.md#configuration). `.env.example` shows them.

## Current state in one table

| Area | State | Details |
| --- | --- | --- |
| Drawings and editor | Done | [03-features.md](03-features.md#drawings-and-editor) |
| Assistant (edit, new diagram, explain) | Done | [03-features.md](03-features.md#assistant) |
| AI tools page and sign-in | Done | [03-features.md](03-features.md#ai-tools-page) |
| Architecture maps, findings, AI review, naming | Done | [03-features.md](03-features.md#architecture-maps) |
| Architecture AI review with file contents | Blocked (not started) | [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md) |
| Code projects (upload, GitHub import) | Done | [03-features.md](03-features.md#code-projects) |
| Math (templates, LaTeX labels, table/axes/number line) | Done | [03-features.md](03-features.md#math) |
| Shape library | Done | [03-features.md](03-features.md#shape-library) |
| Tour | Done | [03-features.md](03-features.md#tour) |
| Learn: courses, lessons, sources, build-up, retry | Phases 0 to 4 done | [04-learn-feature.md](04-learn-feature.md) |
| Learn: quizzes, bigger courses, plan limits | Future (phases 5 and 6) | [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md) |
| Hosted subscription | Future track, blocked on provider approval (phase 7) | [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md) |

## Vocabulary

- **Drawing** (also "diagram"): a saved `.excalidraw` file in `DIAGRAMS_DIR`.
- **Architecture model** (`<name>.arch.json`): the scanned folder graph for a map. A **layout** (`.arch-layout.json`) stores box positions. A **review** (`.arch-review.json`) stores the AI review.
- **Code project**: a folder uploaded through the app or downloaded from GitHub, kept under `PROJECTS_DIR`. **Arch project**: a folder listed in `ARCH_PROJECTS` that scans may read.
- **Graph**: the model's answer for a diagram, as nodes and edges with no coordinates. Layout computes the positions.
- **Provider**: a local AI tool, `claude` or `codex`.
- **Selection**: the chosen provider, model and effort (the "reasoning effort" level).
- **Lesson**: one saved topic (diagram, explanation, key terms, sources). **Course**: a saved outline of modules and topics, each topic with an optional lesson.
- **Build-up**: the step-by-step drawing of a lesson diagram.
