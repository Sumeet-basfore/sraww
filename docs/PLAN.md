# sraww — Implementation Plan

A local, single-user, Excalidraw-style whiteboard with:

1. Local file storage (no accounts, no cloud, works offline).
2. AI-assisted diagram creation and editing, using your existing Claude Pro and Codex Plus subscriptions through their local CLIs (no API keys).
3. An **architecture diagram** feature that reads a codebase and draws its structure (components, dependencies, boundaries), so projects are easier to understand at a glance.

Status: **PLAN ONLY — not started.** Build begins when you reply `approve`.

---

## 0. Decisions (defaults — change any before approval)

| # | Decision | Default I chose | Why |
|---|----------|-----------------|-----|
| D1 | Where the code lives | This repo (`/home/sumeet/.t3/projects/sraww`) | It's the T3 project you'll push from. `CLAUDE.md` says new projects go under `personal-repo/projects/`; tell me if you want that instead. |
| D2 | Editor engine | `@excalidraw/excalidraw` **pinned to an exact 0.18.x** | Official embeddable editor, MIT. Pinned because the embed API can change between versions. |
| D3 | Frontend | Vite + React + TypeScript | Excalidraw is a React component; Vite needs no SSR. |
| D4 | Backend | Node + Express 5, TypeScript, `zod` validation | Tiny local server for file I/O and AI calls. |
| D5 | AI providers | Local **Claude Code CLI** (Claude Pro) and **Codex CLI** (ChatGPT Plus), spawned by the server | You want your existing subscriptions, not API keys. See §2b. |
| D6 | First code-extraction language | TypeScript/JavaScript | Covers most of your likely projects; more languages come after. **Tell me your main languages.** |
| D7 | Commit trailers | No `Co-Authored-By` trailer | Your `CLAUDE.md` says not to add one unless the project's `.claude/settings.json` sets `attribution.commit`. The attribution reminder I was given defers to `CLAUDE.md`, so I'm following it. Say if you want the trailer. |
| D8 | Package manager | npm | Already installed (v12); no extra tooling. |
| D9 | Node version | `engines: node >=22` | Node 26 is installed; 22 is a safe floor. |
| D10 | Push | **No `git push`** until you give the GitHub report | You asked to push later yourself. |
| D11 | API keys | **None.** No API-key env vars, no provider SDKs | Subscriptions only. |
| D12 | Models | Each CLI's default; optional overrides `CLAUDE_MODEL` / `CODEX_MODEL` | Avoids hardcoding model IDs that go stale. |

---

## 1. Product scope

### In scope (v1)
- Create, open, rename, duplicate, delete diagrams (stored as `.excalidraw` JSON files).
- Autosave with a visible "saved / unsaved" state.
- Hand-drawn (default) and clean ("architect") drawing styles, dark mode.
- Export PNG / SVG / `.excalidraw` (built into Excalidraw).
- **AI:** (a) generate a diagram from a text prompt, (b) chat panel that edits the current diagram, (c) explain a selected region.
- **Architecture:** scan a folder → build a component/dependency model → render a laid-out diagram → regenerate and diff against the last scan → click a node to see its file path.

### Out of scope (v1)
- Real-time collaboration, accounts, sync, sharing links.
- Mobile layout (desktop browser only).
- Multi-language extraction beyond TS/JS (added as later phases, not v1).
- Running the app on a network interface (server binds to `127.0.0.1` only).

---

## 2. Architecture of the app

```
Browser (React + Excalidraw)  ──HTTP (127.0.0.1)──  Local server (Express)
  ├─ Diagram list / editor                              ├─ /api/diagrams   → storage (fs, DIAGRAMS_DIR)
  ├─ AI chat + generate panel  ─────────────────────►   ├─ /api/ai/*        → provider adapters → local `claude` / `codex` CLIs (your logins)
  └─ Architecture view                                  └─ /api/arch/*      → scanner → model → layout → diagram
```

Key principles:
- **The server owns all file access and runs the AI CLIs.** The browser never picks arbitrary paths and never talks to an AI service directly. The app stores no credentials; each CLI keeps its own login.
- **The AI never chooses coordinates.** It outputs a graph (nodes and edges). Code does layout (ELK). This avoids overlapping boxes and tangled arrows.
- **Architecture model is the source of truth; the Excalidraw scene is a rendering of it.** Node positions the user drags are stored in a sidecar layout file so a re-scan doesn't scramble the diagram.

### Data on disk (`DIAGRAMS_DIR`, default `./data/diagrams`, git-ignored)

```
data/diagrams/
  system-overview.excalidraw          # Excalidraw scene (standard format)
  my-api.arch.json                    # architecture model (nodes, edges, groups, source root)
  my-api.arch-layout.json             # user-dragged positions, keyed by stable node id
```

---

## 2b. AI providers: your subscriptions, no API keys

- **Claude:** Claude Code CLI (`claude`), logged in with your Claude Pro account. Checked on this machine: `claude auth status` reports `authMethod: claude.ai`.
- **Codex:** Codex CLI (`codex`), logged in with your ChatGPT Plus account. Checked on this machine: `codex login status` reports "Logged in using ChatGPT".
- The app has **no keys and no provider SDK**. It starts the CLI as a child process. Each CLI keeps its own login in its own config directory.

Adapter interface (one file per provider, so a third provider such as Ollama is one new file):

```ts
interface AiProvider {
  id: 'claude' | 'codex';
  health(): Promise<{ installed: boolean; loggedIn: boolean; detail: string }>;
  runStructured<T>(prompt: string, jsonSchema: object, opts: { timeoutMs: number }): Promise<T>;
  runText(prompt: string, opts: { timeoutMs: number }): Promise<string>;
}
```

Invocation (flags were checked against the installed CLIs; re-check at build time):
- **Claude:** `claude -p --output-format json --json-schema <schema> --tools ""` with the prompt on stdin. `--tools ""` disables every built-in tool, so the model cannot read or write files. `--model` only when `CLAUDE_MODEL` is set.
- **Codex:** `codex exec --sandbox read-only --ephemeral --skip-git-repo-check --output-schema <schema-file> -o <out-file> -C <empty-dir>` with the prompt on stdin. The app reads `<out-file>`. `--model` only when `CODEX_MODEL` is set.

Safety rules for spawning:
- Use `spawn` with an argument array. Never build a shell string.
- Working directory is an empty folder `data/ai-workdir/`. The CLI can't see your projects unless the app puts the needed text into the prompt.
- Tools are off (Claude) or the sandbox is read-only (Codex).
- Hard timeout (default 120 s, kill on expiry) and a maximum output size (2 MB).
- Pass only `PATH` and `HOME` through to the child, so the CLI can find its login. Nothing else from the environment.
- Output is validated with `zod` even when a schema was requested. On invalid output, retry once with the validation error appended, then show the error.
- Prompt injection: repo folder names, labels, and diagram text go into the prompt as quoted data, with an instruction to treat them as data only. Tools are off, so injected text can't do anything except shape the output.

Provider choice: `AI_PROVIDER` (default `claude`), with a per-request switch in the UI. A status panel shows whether each CLI is installed and logged in. A missing or logged-out CLI disables its option and shows why.

Limits and caveats (important):
- Calls use your subscription's **usage limits**, not per-token billing. Heavy use can hit a limit. The app shows the CLI's own message when that happens.
- Each call starts a new process, so expect a few seconds of latency per request. Keep prompts compact.
- I have not verified each provider's current terms for scripted use of consumer plans. Check them before relying on this heavily.
- The app doesn't hardcode model IDs. Each CLI uses its own default unless you set an override.

## 3. Project layout

```
sraww/
  package.json                 tsconfig.json          vite.config.ts        vitest.config.ts
  .env.example                 .gitignore             README.md (updated in Phase 9)
  docs/PLAN.md
  src/
    shared/                    # types + zod schemas used by client and server
      diagram.ts  arch-model.ts  ai-schemas.ts
    server/
      index.ts                 # express app bootstrap (127.0.0.1 only)
      config.ts                # env parsing + validation
      routes/diagrams.ts  routes/ai.ts  routes/arch.ts
      storage/diagram-store.ts # safe fs access, name validation, atomic writes
      ai/provider.ts  ai/runner.ts  ai/providers/claude-cli.ts  ai/providers/codex-cli.ts  ai/generate.ts  ai/chat-tools.ts  ai/prompts.ts
      arch/scan-ts.ts          # dependency-cruiser wrapper
      arch/build-model.ts      # raw deps → ArchModel (grouping by folder/boundary)
      arch/diff.ts
      arch/to-skeleton.ts      # ArchModel + layout → Excalidraw skeleton
    client/
      main.tsx  App.tsx
      editor/Editor.tsx  editor/useAutosave.ts  editor/export.ts
      diagrams/DiagramList.tsx  diagrams/api.ts
      ai/GeneratePanel.tsx  ai/ChatPanel.tsx  ai/apply-ops.ts
      arch/ArchView.tsx  arch/NodeDetails.tsx  arch/DiffPanel.tsx
      styles/*.css
  tests/
    server/  client/  e2e/  fixtures/
```

Rules carried over from your `CLAUDE.md` and `rules/ecc`: files under 500 lines, functions small, errors handled explicitly, input validated at every boundary (HTTP bodies, AI output, file names), no secrets in git, immutable updates in state code, tests written first (TDD).

---

## 4. Phases (each phase = one or more commits)

Every phase ends with: tests green → `npm run typecheck && npm run lint && npm test && npm run build` pass → a self-review against the checklist in §6 → commit.

### Phase 0 — Scaffold and tooling
- `package.json` with scripts: `dev` (client + server together), `build`, `start`, `test`, `test:e2e`, `lint`, `typecheck`.
- TypeScript (strict), ESLint, Prettier, Vitest (+ Testing Library), Playwright for e2e.
- `.gitignore`: `node_modules`, `dist`, `data/`, `.env`, coverage output.
- `.env.example`: `DIAGRAMS_DIR=./data/diagrams`, `PORT=4317`, `AI_PROVIDER=claude` (or `codex`), `CLAUDE_BIN=claude`, `CODEX_BIN=codex`, `AI_TIMEOUT_MS=120000`. No API keys anywhere.
- Keep `README.md` as-is for now (updated at Phase 9).
- **Acceptance:** `npm run dev` shows a blank page; `npm test` runs one passing smoke test; `npm run build` succeeds.
- **Commit:** `chore: scaffold vite react ts app with express server and tooling`

### Phase 1 — Local diagram storage API
- `diagram-store.ts`: list, read, create, rename, duplicate, delete `.excalidraw` files in `DIAGRAMS_DIR`.
- Name validation: `^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,80}$`. Reject `..`, slashes, absolute paths. Resolve the final path and check it stays inside `DIAGRAMS_DIR`.
- Atomic writes: write to a temp file, then rename, so a crash can't corrupt a diagram.
- Body size limit (e.g. 10 MB) on save.
- Routes: `GET /api/diagrams`, `GET /api/diagrams/:name`, `PUT /api/diagrams/:name`, `POST /api/diagrams`, `PATCH /api/diagrams/:name` (rename), `POST /api/diagrams/:name/duplicate`, `DELETE /api/diagrams/:name`.
- `zod` schema for the Excalidraw file shape (`type`, `version`, `elements`, `appState`, `files`).
- Tests first: path traversal attempts rejected; atomic write leaves no partial file on error; invalid JSON rejected with a clear 400.
- **Acceptance:** all routes covered by tests; traversal tests pass.
- **Commit:** `feat(server): add local diagram storage api with safe paths and atomic saves`

### Phase 2 — Editor shell
- Embed `@excalidraw/excalidraw` (pinned). Import its CSS. Client-only mount. Self-host fonts: copy `dist/prod` fonts into `public/` and set `window.EXCALIDRAW_ASSET_PATH` (so the app works offline).
- Diagram list screen (create / open / rename / duplicate / delete with confirm).
- Editor screen with a top bar: diagram name, back button, saved/unsaved indicator.
- Autosave: debounced (~800 ms) on scene change; only saves when the scene actually changed (compare a hash of elements). Flush on tab close / navigation.
- Dark mode toggle (persisted in `localStorage` — this is a per-browser preference, allowed).
- Drawing style toggle: "Hand-drawn" (roughness 1) vs "Clean" (roughness 0) for new elements.
- Tests: autosave debounce; "no save when unchanged"; list screen rendering from mocked API.
- Verify Excalidraw API names against the installed 0.18.x `.d.ts` files (e.g. `updateScene`, `onChange`, `serializeAsJSON`) before coding.
- **Acceptance:** create a diagram, draw, reload the page, drawing is still there; kill the server mid-edit shows an "unsaved" state, not silent loss.
- **Commits:**
  - `feat(client): embed excalidraw editor with diagram list and autosave`
  - `feat(client): add drawing style and dark mode toggles`

### Phase 3 — Export and import
- Export PNG, SVG, and `.excalidraw` download (Excalidraw built-ins wired to the top bar).
- Import an `.excalidraw` file from disk into the library (validated with the Phase 1 schema).
- Tests: import rejects non-Excalidraw JSON; import of a valid file creates a diagram.
- **Commit:** `feat: add png svg and excalidraw export plus file import`

### Phase 4 — AI: generate a diagram from a prompt
- `ai/provider.ts` and `ai/providers/*-cli.ts`: the two CLI adapters from §2b. The health check runs `claude auth status` and `codex login status`. If a CLI is missing or logged out, its option is disabled in the UI with the reason shown. That's not a crash.
- Structured output: each request passes a JSON Schema to the CLI (`--json-schema` for Claude, `--output-schema` for Codex), and the reply is validated again on our side. The schema describes the skeleton graph: `nodes[{id, label, shape, color?}]`, `edges[{from, to, label?}]`, `groups[]`. Validated with `zod` (`ai-schemas.ts`) before use.
- Post-validation: drop edges whose `from`/`to` aren't real node ids; cap nodes (e.g. 200); sanitize labels (length limit, strip control chars).
- Convert to Excalidraw elements with `convertToExcalidrawElements`, then lay them out with ELK (no hand-set coordinates from the model).
- UI: "Generate with AI" panel → prompt → preview → "Insert" or "Replace". Undo works because it's a normal scene update.
- Tests: fake CLI scripts in `tests/fixtures/` print canned output (no real model calls). Valid output → nodes/edges appear; invalid edge ids dropped; oversize output capped; malformed output → one retry, then a clear error; CLI logged out → option disabled with the reason.
- **Commit:** `feat(ai): generate editable diagrams from prompts via local claude and codex clis`

### Phase 5 — AI: chat that edits the current diagram
- Server builds a compact **scene summary** (element ids, types, labels, positions, connections) — not the whole raw JSON — so token use stays low.
- Chat tools the model can call: `add_nodes`, `add_edges`, `update_labels`, `delete_elements`, `group`, `auto_layout` (layout of a subset). Each is validated and applied as a list of ops (`apply-ops.ts`), not by letting the model write raw Excalidraw JSON.
- Only operations on ids in the summary are allowed; unknown ids are rejected with a message the model can act on.
- Conversation history kept in memory for the session only (not persisted). CLI calls are stateless, so each turn sends the recent transcript (capped) along with the scene summary.
- "Explain selection": sends only the selected elements' summary and returns text in the chat (no changes made).
- Tests: op validation; unknown id rejected; delete requires explicit id; explain makes no scene change.
- **Commits:**
  - `feat(ai): add scene summary and validated edit operations`
  - `feat(ai): add chat panel to edit the current diagram`

### Phase 6 — Architecture model (types, schema, renderer)
- `shared/arch-model.ts` (zod):
  - `ArchModel = { version, sourceRoot, generatedAt, nodes[], edges[], groups[] }`
  - `ArchNode = { id (stable, from path), label, kind ('module'|'component'|'service'|'external'|'store'), path, group?, description? }`
  - `ArchEdge = { from, to, kind ('import'|'calls'|'data'), count }`
  - `ArchGroup = { id, label, members[] }`
- `arch/build-model.ts`: from raw dependency edges → model. Grouping: first by top-level folder, then by a configurable rule file (`.sraww-arch.json` in the scanned repo, optional).
- `arch/to-skeleton.ts` + ELK layout → Excalidraw skeleton. Groups drawn as labeled rectangles behind their nodes; edges as arrows with arrowheads; edge width scales with `count`.
- Layout positions saved to `<name>.arch-layout.json` keyed by node id; on re-render, saved positions win for nodes that still exist.
- Tests: golden-file tests (model → skeleton) on a small fixture repo; layout-preserved-on-rerender test; cycle-tolerant layout test.
- **Commit:** `feat(arch): add architecture model schema and excalidraw renderer with elk layout`

### Phase 7 — Scanner for TypeScript/JavaScript
- `arch/scan-ts.ts`: run `dependency-cruiser` programmatically on the target folder with a fixed config (exclude `node_modules`, `dist`, `.git`, build outputs). Output: module-level import edges.
- Safety: the scanner only reads; target path must be an absolute directory the user registers in settings (allow-list), not any path sent by the browser.
- Caps: max files (e.g. 5 000) and a timeout, with a clear message if the repo is too big.
- Routes: `POST /api/arch/scan` (`{ projectId, name }`) → writes `<name>.arch.json`; `GET /api/arch/:name`.
- Tests: fixture repo with known imports → expected nodes/edges; excluded folders absent; oversized repo rejected.
- **Commit:** `feat(arch): scan typescript and javascript imports into an architecture model`

### Phase 8 — Architecture UI and AI-assisted naming
- New diagram type "Architecture": pick a project folder (registered once), click **Scan**, diagram appears.
- Optional **AI naming** (opt-in button, uses the Phase 4 provider): sends folder names, top-level exports and edges (not file contents) to Claude, asks for component names, one-line descriptions, and boundary labels. Output validated; it only fills labels and descriptions, never adds or removes edges.
- **Diff**: each scan compares with the last saved model → added / removed nodes and edges shown in a side panel, colored in the diagram.
- **Node details**: click a node → side panel with path, description, incoming/outgoing edges, and a "copy path" button. (Optional: open in editor via a `vscode://file/...` link if VS Code is installed.)
- Layout controls: "Reset layout" (discard saved positions), "Re-layout".
- Tests: diff correctness (add/remove); AI naming never changes edge set (test enforces it); node details render from model.
- **Commits:**
  - `feat(arch): add architecture diagram view with scan and node details`
  - `feat(arch): add diff between scans`
  - `feat(ai): add opt-in ai naming for architecture components`

### Phase 9 — Hardening, e2e, docs
- Playwright e2e: create diagram → draw → reload → persisted; scan fixture repo → node count matches; AI tests run against fake CLI scripts (no real model calls in tests).
- Security pass: server bound to 127.0.0.1; reject requests whose `Host` header isn't localhost (DNS-rebinding guard); CSP for the client; no `dangerouslySetInnerHTML`; labels from AI are rendered as text only.
- Error UX: every failure shows a message; no silent catches.
- Coverage: ≥ 80% lines on `src/server` and `src/shared`; client coverage reported, target 70%+ (Excalidraw canvas is hard to unit-test).
- `README.md`: setup, requirements (`claude` and `codex` installed and logged in), `.env`, how to scan a project, how to run tests.
- **Commits:** `test: add playwright e2e coverage for core flows`, `docs: document setup usage and security model`

### Later (not in v1, listed so we don't forget)
- Python import scanning (`pydeps` or `ast`), Go (`go list -deps`), docker-compose / Kubernetes manifests as infra nodes.
- Ollama provider for offline AI (a third adapter, using the interface in §2b).
- Obsidian/markdown export of architecture notes.

---

## 5. Commit and branch rules

- Work on a branch `feat/initial-build` (created at the start of Phase 0); not on `main`.
- One commit per feature or fix, conventional-commit style (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`), with a body when the reason isn't obvious.
- Never commit `.env`, API keys, or anything in `data/`. A pre-commit check greps staged files for `sk-ant-` and common key patterns.
- No `git push`. When you give the GitHub report, I'll push and open the PR.
- Attribution: no `Co-Authored-By` trailer (decision D7).

---

## 6. Quality checklist (applied at the end of every phase)

- [ ] Tests written before the code and now passing; `npm test` green.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- [ ] No file over 500 lines; no function over ~50 lines.
- [ ] Every external input (HTTP body, AI output, file name, scanned file) validated with `zod` at the boundary.
- [ ] Errors surfaced to the user or logged server-side with context; no empty `catch`.
- [ ] No credentials in code, logs, or git. The app never handles API keys or CLI tokens.
- [ ] Self-review done; for Phases 4, 5 and 7 (AI and file scanning) a `code-reviewer` / `security-reviewer` pass is run before the commit.

---

## 7. Risks and how I'll handle them

| Risk | Mitigation |
|------|-----------|
| Excalidraw embed API differs from docs | Pin exact version; verify names against installed `.d.ts` in Phase 2 |
| LLM invents node/edge ids or bloats output | Strict zod schema via tool use; drop bad refs; caps on counts and label length |
| LLM names are wrong or misleading | AI naming only fills labels; user reviews; it never changes structure |
| Re-scan scrambles a diagram the user arranged | Stable node ids + saved layout positions |
| Huge repos make the diagram unreadable | Group by folder by default; cap node count; collapse groups |
| Scanner reads sensitive files | Reads only import graph; never sends file contents to the AI in the extraction path; folder allow-list |
| Subscription usage limits hit | Show the CLI's limit message; compact prompts (scene summaries, not raw files); no auto-run on scan; AI actions are manual buttons |
| CLI output format changes between versions | Fixture-based tests; schema validation on our side; show the raw error on failure |
| Prompt injection from repo names or diagram text | Input quoted as data; tools off for Claude; read-only Codex sandbox in an empty working dir |
| Excalidraw bundle size | Dynamic import of the editor; check build size in Phase 9 |

---

## 8. Open questions (I'll use the default unless you say otherwise)

1. Confirm the location (D1): this repo, or `personal-repo/projects/sraww`?
2. Which languages do your projects use most? (Decides Phase 7 order beyond TS/JS.)
3. Default provider when both CLIs are available: Claude or Codex? Plan default: Claude, with a per-request switch in the UI.
4. Commit trailer (D7): none, as planned?
5. Do you use VS Code? (Decides whether "open in editor" links are worth building.)

---

## 9. What "approve" starts

On `approve` I will: create `feat/initial-build`, do Phase 0, then run Phases 1–9 in order, committing as above. I'll stop and report only if a phase is blocked (for example, a CLI that isn't logged in when I need it for a manual check; the automated tests use fake CLIs, so they still run). When everything is done I'll tell you the commit list and the test results, and wait for your GitHub report before pushing.
