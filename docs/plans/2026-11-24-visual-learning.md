# Visual learning mode — Plan (rev 2)

**Goal:** a learner types a topic, the AI finds valid sources on the web and builds a short course from
them. Each topic is taught on the canvas: the diagram is drawn step by step (nodes, then arrows, then
labels), a panel beside it explains the whole picture and lists its sources, and the learner moves on
with **Next** when ready. Completed modules also offer optional local retrieval practice.

**Product direction:** sraww has two tabs that matter most, **Architecture** and **Learn**, next to
**Drawings** and **AI tools**. The app stays minimal and plain enough for non-technical users. The free
path uses the learner's own Claude Code or Codex CLI. A paid, hosted plan (sraww's own model access, in
the style of OpenCode Go) is a future track that needs provider approval first.

**Architecture:** reuse what exists. The assistant's "New diagram" path already turns a sentence into a
structured graph, and ELK computes the layout, so a lesson diagram is an AI graph plus the existing layout
code. New parts: the course outline and per-topic generation with web research, a step planner that turns
the laid-out graph into a build sequence, a playback engine that writes into the canvas, and the Learn tab.
Storage stays under `DIAGRAMS_DIR`.

**Tech stack:** TypeScript, Express 5, Zod 4, React 19, Excalidraw 0.18.0, ELK (existing), Vitest,
Playwright. No new runtime dependencies are planned.

**Effort (estimate):** about 18 working days for phases 0–4 (the MVP). Phase 5 is a completed follow-up;
phases 6–7 remain future work.

**Research basis:** read 2026-11-24. Diagram tools are common, but none combines AI course generation,
build-up animation and sourced teaching. Closest rivals: Diagramstalk (Mermaid, stepwise reveal, free,
works with Ollama) and LearnSketch (narrated Excalidraw lessons, pricing unverified). Pedagogy: animation
helps when learning change over time; learner control and retrieval practice help learning. Vendor claims
are unverified until tested. Consumer subscriptions cannot be resold, and API resale needs written
provider approval (Anthropic) or a check against the business terms (OpenAI). See the research summary.

---

## Decisions

1. **Free path stays local.** Lessons run through the learner's own Claude Code or Codex CLI, as the
   assistant does. Nothing goes to the maintainer.
2. **Separate tabs.** Learn is its own tab, and Architecture is its own tab. Drawings and AI tools are the
   other two. The drawing editor is not changed, except that a lesson topic opens a read-only canvas in
   the Learn tab.
3. **Storage.** Lessons and courses are JSON files in separate folders under `DIAGRAMS_DIR`.
   Module quizzes are sidecars under `DIAGRAMS_DIR/learn-quizzes/<courseId>/<moduleId>.json`, so result
   updates cannot overwrite course progress.
4. **Pacing (kept default): auto-play with control.** The build-up plays on its own. The learner can
   pause, replay, skip to the end, and step one element at a time with the arrow keys. Playback never
   blocks **Next**.
5. **Teaching from sources (new).** Lessons are built from web sources that the CLI finds and reads. Each
   lesson lists the sources it used, with links, and each explanation point names the source it came from.
   The app checks every cited URL before it is shown (see Sources below). We do not label lessons as
   "AI-generated", as you asked. Our recommendation is one small line on each lesson: "Taught by an AI
   assistant from the sources below." Without it, a lesson could look like a fact-checked human course,
   and a citation could be misread.
6. **Optional quizzes (Phase 5).** A completed module can offer up to five short-answer questions. Learners
   reveal a sample answer and self-rate; typed answers are not sent or saved.
7. **Model: highest effort by default.** Lessons use the model and effort chosen on the AI tools page,
   which defaults to the highest effort the CLI offers. The user can lower it. Higher effort means slower
   lessons and more usage per topic, so the lesson page shows an estimate of time before a course is built.
8. **Scope limits (kept).** At most 12 topics per course and 8 modules in the MVP. Each topic diagram is
   capped at 14 nodes and 20 arrows. Bigger courses and per-plan limits come later (Phase 6).
9. **Hosted subscription (future track, not MVP).** sraww's own paid plan, with model access sold to
   users. It needs provider approval, accounts, payments, a new privacy policy and consumer-law review. See
   Phase 7.

---

## Sources (decision 5, in detail)

- The lesson call enables web search and page fetching in the CLI only. It disables file editing, shell
  and other tools. It runs in an empty working folder, as the existing AI calls do.
  **Spike result (2026-11-24): both CLIs can search with file and shell tools off.**
  - Claude Code: `claude -p --tools "WebSearch,WebFetch" --allowedTools "WebSearch,WebFetch"`. The run
    reported one web search request and no permission denials.
  - Codex: search works with `codex --search exec --sandbox read-only --ephemeral`, but **Codex is not
    used for lessons.** The review of PR #11 found that the model keeps a command tool inside that
    sandbox. Listing its tools with `--disable shell_tool --disable unified_exec` still showed
    `functions.exec`, and the read-only sandbox does not stop reads. A steered page could make Codex
    read a local file and put its contents into a search query. The Codex provider's `generate` (in `src/server/ai/providers/codex-cli.ts`) now refuses
    web-enabled calls. Codex lessons wait for a way to remove the command tool.
- The model must return sources as a list: title, URL, and the points it took from each. Limits: at most
  5 sources per topic, https only, each URL at most 200 characters.
- The server checks each URL before the lesson is saved: it fetches the page with a timeout, a byte cap
  and a redirect limit, and keeps only the sources that resolve. A lesson with no resolvable source is
  marked failed and can be retried. This checks that the page exists. It does not prove that the page
  supports each point, so the explanation is still written as a summary of the sources.
- Fetched page text is untrusted. It is quoted to the model as data, the output must match the schema,
  and the model has no tools that act on anything but search and fetch. Page content is never shown to the
  learner as code or HTML.
- Egress: the CLI makes the search and page requests, not sraww. The server makes one HEAD or GET per
  cited URL to check it. Both are public URLs, and `PRIVACY.md` must say so.

---

## Minimal design rules (before any screen is built)

- **Plain words.** Labels are short verbs or nouns: "Build course", "Next", "Replay", "Sources". No
  jargon in the main flow. Technical terms appear only in the Architecture tab, with a one-line explanation.
- **One main action per screen.** Each screen has one primary button. Everything else is secondary text
  or a menu.
- **Few choices at once.** At most four top-level tabs. Settings and model choice live under AI tools, not
  in the lesson view.
- **Progressive detail.** A short explanation first, with "More" to show the details or the full sources.
- **Accessible by default.** Keyboard reachable, visible focus, reduced motion respected, readable at
  phone width with no horizontal scroll.
- **Same look as the app.** Existing tokens and fonts (Space Grotesk and JetBrains Mono). No new visual
  system.

---

## User flow

1. **Learn** tab → type a topic ("how HTTP caching works") → **Build course**.
2. The outline appears: modules and topics, each with a status (not started, building, ready, failed).
3. Open the first topic. The canvas is empty. The build-up plays: boxes first, then arrows, then labels,
   in an order that follows the layout.
4. The right panel shows the explanation, the sources with links, and the controls **Replay**,
   **Pause / Play**, **Skip to end**, and **Next**. Next is enabled once the build-up finishes or after
   **Skip to end**.
5. **Next** moves on. Progress saves when the learner moves on, so reopening the app resumes at the same
   topic.

---

## Architecture

### Data

```
Course   { id, title, prompt, createdAt, modules: Module[], progress: { topicId } }
Module   { id, title, topics: Topic[] }
Topic    { id, title, summary, status: 'outline'|'building'|'ready'|'failed', lessonFile?, error? }
Lesson   { topicId, graph (existing AI graph schema), explanation (markdown, ≤ 1,500 chars),
           keyTerms: string[] (≤ 8), sources: { title, url, points: string[] }[] (≤ 5),
           generatedAt, provider, effort }
```

Zod schemas live in `src/shared/learn.ts`, beside the AI graph schemas. Lesson JSON is stored at
`DIAGRAMS_DIR/lessons/<lessonId>.json`. Module quiz sidecars are stored at
`DIAGRAMS_DIR/learn-quizzes/<courseId>/<moduleId>.json`.

### Server

- `POST /api/learn/courses` — body `{ topic }`, validated (1–300 characters). Builds the outline with
  no web search, validates it, and stores the course.
- `GET /api/learn/courses` lists saved courses. `GET /api/learn/courses/:id` returns the course, built
  lesson ids and saved quiz result summaries.
- `POST /api/learn/courses/:id/topics/:topicId/lesson` builds one topic's lesson and reuses it later.
- `PUT /api/learn/courses/:id/progress` saves the last topic opened.
- `POST /api/learn/courses/:id/modules/:moduleId/quiz` reuses a saved quiz or generates one after every
  module lesson is built. The selected CLI receives course/module titles and lesson explanations and key
  terms with tools and web search disabled. Codex is refused because its command tool cannot be guaranteed
  off.
- `PUT /api/learn/courses/:id/modules/:moduleId/quiz/results` accepts only a self-rated count and saves
  aggregate attempts, best and last counts.

All AI output is validated against the schemas and capped in size. The topic is quoted to the model as data.

### Client

- `src/client/learn/LearnPage.tsx` — topic entry, outline, course list.
- `src/client/learn/CoursePage.tsx` and `CourseOutline.tsx` — built module actions and saved results.
- `src/client/learn/ModuleQuiz.tsx` — local short answers, sample answer reveal and self-rating.
- `src/client/learn/LessonView.tsx` — read-only canvas plus the explanation and sources panel.
- `src/client/learn/build-steps.ts` — the step planner (pure): ordered steps and the visible part of a graph.
- `src/client/learn/playback.ts` — the playback state machine (pure reducer).
- `src/client/learn/usePlayback.ts` — the timer that drives the reducer.
- `src/client/learn/lesson-scene.ts` — turns the visible part of a graph into Excalidraw elements.
- `src/client/learn/BuildControls.tsx` — Replay, Back, Pause/Play, Next, Skip to end, step count, arrow keys.

### Step planner (the new core)

Input: a graph (nodes, edges, groups). Output: an ordered list of steps, each one node.

- Order: nodes in topological order (ties go to the earlier declaration; a cycle takes its earliest
  unplaced node). A group's frame appears with its first node, before that node is drawn. Each arrow appears
  once both of its ends are shown.
- Batch size: one node per step by default (`nodesPerStep` can raise it).
- Deterministic for the same graph, so it is unit-tested without a browser.

### Playback engine

- State is the number of steps shown and whether playback is running. Each step writes the whole visible
  scene with `updateScene`, so the scene is always a pure function of the step count.
- Timing: 1200 ms per step. Pause stops the timer. Next works at any point. Skip to end shows everything.
- Replay returns to step 0 and plays again. Playback never changes the stored lesson.
- With reduced motion on, the build-up is skipped and the full diagram appears; Play is disabled and
  Next and Back still step through it.
- With reduced motion on, the build-up is skipped and the full diagram appears.

---

## Phases

### Phase 0 — Tabs and minimal shell (3 days)

- Top-level navigation: Drawings, Learn, Architecture, AI tools. Architecture stays reachable from the
  editor too.
- Plain-language copy for the existing screens, reviewed against the minimal design rules.
- **Done when:** the four tabs work at phone and desktop width and the copy passes the plain-words rule.

### Phase 1 — Sourced lesson, static (5 days)

- Spike first (half a day): confirm the Claude and Codex CLIs can search and fetch under our flags, and
  record the result in this plan.
- Source schema, URL checks (timeout, byte cap, redirect limit), lesson route with a fake provider in tests.
- LessonView shows the finished diagram, the explanation and the sources. No animation yet.
- **Done when:** a topic produces a validated lesson with resolvable sources and renders as a static diagram.

### Phase 2 — Course outline and progress (3 days)

- Outline from general knowledge with no web search, outline validation, course list, progress save and restore.
- **Done when:** a course can be created, reopened and resumed at the saved topic.

### Phase 3 — Build-up animation (4 days)

- Step planner with unit tests (ordering, batch size, determinism, groups before nodes, arrows after
  endpoints).
- Playback engine and controls: Replay, Pause/Play, Skip to end, arrow keys, reduced motion.
- **Done when:** the build-up plays in order for the sample lessons, can be paused and resumed, and Next
  works at any point.

### Phase 4 — Polish, privacy and tests (3 days) — done

- Key terms, failure states (a failed topic can be retried), the time estimate before a course is built.
- Mobile layout: explanation below the canvas at phone width.
- `PRIVACY.md` and the README security notes updated for web research (see Sources).
- E2E spec with a stubbed AI and stubbed source pages: create a course, play one build-up, move on, reload
  and resume.
- **Done when:** the e2e spec passes, and the layout works at 390px and 1440px in light and dark themes.
- **Status:** done on `feat/polish-and-privacy`. Landed: retry for a failed course, outline or topic, the
  time line, faint-text contrast fix, e2e at 390px (light and dark) and 1440px, resume after reload, and
  the PRIVACY and README updates. **Deferred:** a lesson page that fails to load still has no retry button,
  and reduced motion at phone and desktop width is not covered by e2e.

### Phase 5 — Optional module quizzes — done

- The outline offers **Practice module** only after every lesson in that module is built. A saved quiz is
  reused; concurrent generation requests share one CLI call. Questions use the selected CLI with tools and
  web search disabled. Codex is refused because its command tool cannot be guaranteed off.
- Up to five short-answer questions show a sample answer and explanation. The typed draft stays in the
  component and is cleared on reveal or exit; no answer is sent to a CLI or stored.
- Self-rating saves aggregate `attempts`, `bestSelfRated` and `lastSelfRated` counts in a separate sidecar
  under `DIAGRAMS_DIR/learn-quizzes`, plus up to 256 recent opaque attempt ids to make retries idempotent.
  A delayed retry older than this window is treated as new. Result updates serialize per course and module.
  Practice never gates lesson navigation or course progress.
- **Status:** implemented on `feat/learn-module-quizzes`; focused server, client and e2e checks verify it.

### Phase 6 — Bigger courses and plan limits (future)

- More modules and topics per course, and per-plan limits (for example, topics or courses per month).
  Limits depend on the user and on what the paid plan covers.

### Phase 7 — Hosted subscription (future track, not planned)

- sraww-hosted model access sold as a monthly plan, like OpenCode Go.
- Prerequisites: written approval or a commercial agreement from each model provider; accounts; payments;
  a new privacy policy because sraww would hold keys and user content; consumer-law review (EU withdrawal
  rights, UK subscription rules); cost per lesson measured from real use.
- Not started until the prerequisites are met.

---

## Test plan

- **Unit:** schemas (valid, invalid, oversized), URL checks (timeout, redirect limit, non-https rejected),
  the step planner (ordering, batch size, determinism), playback state (pause, resume, skip, replay),
  progress store.
- **Component:** LessonView controls (Next enabled after build-up or skip; Replay resets the scene); the
  sources list shows only checked URLs.
- **Server:** routes return 400 on bad input, cap sizes, and never write outside `DIAGRAMS_DIR`.
- **E2E:** stubbed AI and stubbed source pages; create a course, play one build-up, move on, reload, resume.
- **Manual:** the build-up at 390px and 1440px, light and dark themes, reduced motion on.

---

## Risks

| Risk                                       | Mitigation                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| A cited source does not support the point  | Check each URL exists; summarise, do not quote; show the sources so the learner can check.                   |
| Web tools widen what the CLI can reach     | Allowlist search and fetch only; no shell or file tools; empty working folder; tested in Phase 1.            |
| Fetched pages carry hidden instructions    | Page text is quoted as data; output must match the schema; the model has no action tools.                    |
| Highest effort is slow and uses more usage | Time estimate before building; the user can lower effort on the AI tools page.                               |
| Build-up feels slow on long lessons        | Lessons cap at 14 nodes; Skip to end; 1200 ms per step.                                                      |
| Scope creep into a full learning platform  | MVP is one course at a time, no accounts, no grading; quizzes and plans come later.                          |
| The hosted plan is started before approval | Phase 7 is blocked on written provider approval; nothing in the MVP stores keys or user content on a server. |

---

## Open items

1. ~~Phase 1 spike: can both CLIs search and fetch under our flags?~~ Done 2026-11-24, both can (see
   Sources). Still open: Codex's read scope under its sandbox.
2. Wording of the lesson line on sources (decision 5). Confirm the recommended line or pick your own.
3. The design direction for the four tabs. The minimal design rules above are the starting point; they
   should be checked with a quick mockup before Phase 0 starts.
