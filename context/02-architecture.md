# 2. Architecture

## Layers

```
Browser (React 19 + Excalidraw)               Local server (Express 5, 127.0.0.1)
  src/client/   pages, editor, assistant,       src/server/   routes -> services -> storage / AI / scanner
                AI tools, architecture view,     src/shared/   zod schemas and types used by both sides
                Learn tab, tour
  --- HTTP JSON under /api, same origin ----------
```

- `src/shared/` holds every zod schema and every type that crosses the HTTP boundary. Both sides parse with the same schema. Validate at every boundary: request bodies, files read from disk, and model output.
- `src/server/` is split into `routes/` (Express routers, thin), `storage/` (file access), `ai/` (provider adapters, prompts, parsing, runner), `arch/` (scanner built on `dependency-cruiser`, model, findings, review, naming), `projects/` (intake, GitHub, store), `learn/` (lesson and outline builders, source checks), `math/` (LaTeX to SVG).
- `src/client/` is grouped by feature: `editor/`, `ai/` (assistant and AI account pages), `arch/`, `learn/`, `math/`, `diagrams/` (drawing list), `projects/`, `library/`, `tour/`, `nav/` (top header), `lib/` (api helpers, routing, preferences, errors).

## Request flow examples

- **Save a drawing:** the editor's autosave calls `PUT /api/diagrams/:name` with the scene. The store validates the name and the content, then writes the file. The status line shows saved or unsaved.
- **Assistant new diagram:** the browser posts the prompt to `POST /api/ai/generate`. The server builds a prompt, starts the chosen CLI, reads its structured answer, validates it against `diagramGraphSchema`, normalises it, and returns a graph. The browser lays it out with `elkjs` and draws it.
- **Architecture scan:** `POST /api/arch/scan` reads the folder (only from `ARCH_PROJECTS` or an uploaded project), builds the model, computes findings, and stores `<name>.arch.json`. The browser lays out the model and draws it.
- **Learn lesson:** opening a topic calls `POST /api/learn/courses/:id/topics/:topicId/lesson`. The server runs the lesson builder with web research, checks each cited source URL, and saves the lesson. Details in [04-learn-feature.md](04-learn-feature.md).

## Routes (HTTP)

All API routes are mounted in `src/server/app.ts`. Every request passes the local-only guard (`guard.ts`) first.

| Mount                  | Router                    | Endpoints                                                                                                                                                                                   |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`          | inline                    | `GET` health check                                                                                                                                                                          |
| `/api/diagrams`        | `routes/diagrams.ts`      | `GET /` list; `POST /` create; `GET /:name`; `PUT /:name` save; `PATCH /:name` rename; `POST /:name/duplicate`; `DELETE /:name`                                                             |
| `/api/math`            | `routes/math.ts`          | `POST /render` LaTeX to SVG                                                                                                                                                                 |
| `/api/library`         | `routes/library.ts`       | `GET /`; `PUT /` (shape library)                                                                                                                                                            |
| `/api/projects`        | `routes/projects.ts`      | `GET /` list; `POST /github` import a public branch; `POST` upload (folder or zip); `DELETE /:id`                                                                                           |
| `/api/arch`            | `routes/arch.ts`          | `GET /projects`; `POST /scan`; `GET /models/:name`; `GET /models/:name/findings`; `GET` and `POST /models/:name/review`; `PUT` and `DELETE /models/:name/layout`; `POST /models/:name/name` |
| `/api/ai`              | `routes/ai.ts`            | `GET /status`; `POST /generate`; `POST /chat`; plus the account router (below)                                                                                                              |
| `/api/ai/providers...` | `routes/ai-account.ts`    | `GET /providers`; `PUT /default`; `PUT /providers/:id/selection`; sign-in: `GET`/`POST`/`DELETE /providers/:id/login`, `POST /providers/:id/login/code`                                     |
| `/api/learn`           | `routes/learn.ts`         | `POST /lessons` (single lesson, no UI caller yet); `GET /lessons/:id`                                                                                                                       |
| `/api/learn`           | `routes/learn-courses.ts` | `POST /courses`; `GET /courses`; `GET /courses/:id`; `POST /courses/:id/topics/:topicId/lesson`; `PUT /courses/:id/progress`                                                                |
| `/PRIVACY.md`          | inline                    | serves the policy                                                                                                                                                                           |
| static                 | `express.static`          | serves `dist/` built client when it exists, else `index.html` fallback                                                                                                                      |

Unknown `/api` paths return a JSON 404. Errors use a shared handler (`errors.ts`). Learn errors use `DiagramError` codes such as `NOT_FOUND`.

## Client routes (hash based)

Parsed by `src/client/lib/route.ts`. Each route maps to one page in `App.tsx`.

| Hash                  | Page                            |
| --------------------- | ------------------------------- |
| `#/` or empty         | Drawings list                   |
| `#/diagram/<name>`    | Editor                          |
| `#/architecture`      | Architecture maps page (`maps`) |
| `#/arch/<name>`       | One architecture map            |
| `#/learn`             | Learn tab                       |
| `#/learn/<lessonId>`  | Lesson                          |
| `#/course/<courseId>` | Course                          |
| `#/ai`                | AI tools page                   |

Top-level tabs are **Drawings**, **Learn**, **Architecture**, **AI tools** (`src/client/nav/PageHeader.tsx`, `MAIN_TABS`). Route ids in hashes are validated: lesson and course ids match `^[a-zA-Z0-9_-]{1,64}$`. Diagram names are validated on the server.

## Data on disk

Everything lives under the data folders named in configuration. Nothing else is written, except temporary files that are renamed into place.

`DIAGRAMS_DIR` (default `./data/diagrams`):

| File                      | Holds                                 |
| ------------------------- | ------------------------------------- |
| `<name>.excalidraw`       | A drawing (Excalidraw JSON)           |
| `<name>.arch.json`        | An architecture model (scanned graph) |
| `<name>.arch-layout.json` | Box positions the owner saved         |
| `<name>.arch-review.json` | The stored AI review of a model       |
| `library.json`            | The shape library                     |
| `lessons/<id>.json`       | One lesson                            |
| `courses/<id>.json`       | One course with its progress          |

`PROJECTS_DIR` (default `./data/projects`): one folder per uploaded or imported project, with the kept files and a `manifest.json` written last.

`AI_SETTINGS_FILE` (default `./data/ai-settings.json`): the chosen default tool and, per tool, the model and effort. Sign-in state is not stored here; the CLIs keep their own.

`AI_WORKDIR` (default `./data/ai-workdir`): an empty folder the CLIs run in, so they cannot see the owner's projects.

JSON writes go to a temporary file with a random name, then are renamed. A record is never half written. Ids are checked before they become file names, so a request cannot reach outside its folder.

## Configuration

Read once at startup by `src/server/config.ts` (zod). Invalid values stop the server with a readable message. `.env` is loaded when present.

| Variable                      | Default                   | Meaning                                                      |
| ----------------------------- | ------------------------- | ------------------------------------------------------------ |
| `PORT`                        | `4317`                    | Server port                                                  |
| `DIAGRAMS_DIR`                | `./data/diagrams`         | Drawings, architecture files, library, lessons, courses      |
| `PROJECTS_DIR`                | `./data/projects`         | Uploaded and imported code projects                          |
| `AI_WORKDIR`                  | `./data/ai-workdir`       | Empty working folder for the CLIs                            |
| `ARCH_PROJECTS`               | empty                     | Comma-separated absolute folders architecture scans may read |
| `AI_PROVIDER`                 | `claude`                  | Default tool (`claude` or `codex`)                           |
| `CLAUDE_BIN`, `CODEX_BIN`     | `claude`, `codex`         | CLI names or paths                                           |
| `CLAUDE_MODEL`, `CODEX_MODEL` | empty                     | Optional model override; empty uses the CLI default          |
| `AI_TIMEOUT_MS`               | `120000`                  | Time limit for one AI call (minimum 1000)                    |
| `AI_SETTINGS_FILE`            | `./data/ai-settings.json` | Saved AI choices                                             |

There are no API key variables, and none should be added.

## AI provider design

- `src/server/ai/provider.ts` defines `AiProvider`: `id`, `health()`, and `generate(prompt, schema, options?)`. `options.webSearch` asks for web tools (Claude only; Codex refuses, see [04-learn-feature.md](04-learn-feature.md)).
- Two adapters: `providers/claude-cli.ts` and `providers/codex-cli.ts`. Each starts a new CLI process per call.
  - Claude: `claude -p --output-format json --json-schema ...`. Without web search it passes `--tools ''` (no tools). With web search it passes `--tools WebSearch,WebFetch --allowedTools WebSearch,WebFetch`.
  - Codex: `codex exec --sandbox read-only --ephemeral ... --output-schema`. Codex keeps its shell tool even in a read-only sandbox, which is why web calls are refused on Codex.
- `runner.ts` runs one process with the timeout, a cleared environment (only `PATH` and `HOME` are kept), and the working folder set to `AI_WORKDIR`.
- `structured.ts` (`generateStructured`) parses the answer, validates it with zod, and retries once on failure. Failures surface as `AiError` with a code (for example `INVALID_OUTPUT`, `FAILED`).
- `prompts.ts` wraps user content in tags and strips those tags from the content first, so user text cannot close the tags and pose as instructions. The `quoteAsData` helper strips `request`, `message`, `diagram`, `project`, `findings` and `topic`.
- `normalize-graph.ts` and `parse-output.ts` clean model output before the schema check. Size limits are part of the schemas in `src/shared/ai-schemas.ts` (`GRAPH_LIMITS`: 80 nodes, 160 edges, 60-character labels).
- `services.ts` builds the provider set and reports the current default. `selection.ts` checks a chosen model and effort against what the tool offers. `settings-store.ts` saves the choice. Default settings have no effort set, so the CLI's own default applies.
- Account state comes from the CLIs (`claude auth status`, `codex login status`) through `src/server/ai/account/`. Sign-in flows run the CLI's login command and relay its prompts to the page.

## Client architecture

- `App.tsx` picks the page from the parsed hash. The editor (`editor/Editor.tsx`) and the lesson canvas (`learn/LessonCanvas.tsx`) are loaded lazily, so the other pages do not pay for Excalidraw's size.
- Excalidraw is used through its React component with `excalidrawAPI`, `viewModeEnabled` for read-only lesson canvases, and `UIOptions` from `src/client/editor/drawing-options.ts`. Scenes are changed with `updateScene`.
- Diagram layout uses `elkjs` (`src/client/ai/layout.ts`). Skeletons for Excalidraw come from `src/client/ai/skeleton.ts`. Style rules are in `style.ts`.
- Preferences (theme, drawing style) are kept in `localStorage` through `src/client/lib/prefs.ts`. Only per-viewer conveniences are stored there.
- Errors shown to the user come from `src/client/lib/errors.ts`. Network failures read "sraww could not be reached".

## Security boundaries (summary)

- The server listens on `127.0.0.1` and checks Host and Origin headers on every request.
- A strict Content Security Policy is sent, with no framing.
- Model output is drawn as text, never as HTML. Formula SVG is sanitised.
- Project content is passed to the model as quoted data, metadata only, for the review and naming features.
- Lesson sources are the only outbound requests the server makes on its own, besides GitHub import. See [09-privacy-and-security.md](09-privacy-and-security.md).
