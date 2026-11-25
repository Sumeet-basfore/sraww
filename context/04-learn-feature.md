# 4. The Learn feature

## What the learner does

1. On the **Learn** tab, type a topic and press **Build course**. The AI drafts an outline of modules and topics, with no web search. A course can take a minute or more. The tab says so.
2. The course page lists the modules, each topic with a one-line summary, **Ready** or **Not built yet**, and a **Last opened** tag. **Continue** resumes the last topic opened.
3. **Open lesson** on a topic builds its lesson once. A lesson uses web research, so it can take longer. Later opens reuse the saved lesson.
4. The lesson page has the diagram on the left (drawn step by step, see the build-up below) and the explanation, key terms and sources on the right. Phones stack the diagram above the explanation.
5. If a build fails, a plain alert appears with **Try again**. A failed topic can be opened again without reloading.
6. When every lesson in a module is built, **Practice module** offers up to five short-answer questions. The learner writes an answer, reveals a sample answer and explanation, then self-rates. The typed draft stays in the page and is cleared on reveal or exit. Aggregate attempt, best and last counts are saved, with up to 256 opaque attempt ids for retry deduplication. Practice never gates lesson navigation or progress. A retry older than the window is treated as a new attempt.

## Status

Phases 0 to 4 are done and merged (PRs #11 to #16, see [06-history.md](06-history.md)). Phase 5 (optional quizzes) is implemented on `feat/learn-module-quizzes`. Phase 6 (bigger courses) and Phase 7 (hosted subscription) remain future work. See [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md).

## Data shapes

All in `src/shared/learn.ts`. Diagrams reuse the app's graph schema from `src/shared/ai-schemas.ts`, with smaller limits.

**Limits (`LEARN_LIMITS`)**

| Limit                      | Value                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| Topic text                 | 300 characters                                                             |
| Lesson title               | 120                                                                        |
| Lesson explanation         | 1,500                                                                      |
| Key terms                  | up to 8, 60 characters each                                                |
| Sources                    | up to 5; each has a title (160), a URL (200) and up to 6 points (300 each) |
| Lesson diagram             | up to 14 nodes and 20 edges                                                |
| Course title, module title | 120                                                                        |
| Topic title                | 160                                                                        |
| Topic summary              | 240                                                                        |
| Modules per course         | up to 8                                                                    |
| Topics per course          | up to 12 in total                                                          |
| Topics per module          | up to 12                                                                   |
| Quiz questions per module  | up to 5                                                                    |
| Quiz prompt                | up to 500 characters                                                       |
| Sample answer              | up to 1,200 characters                                                     |
| Quiz explanation           | up to 1,000 characters                                                     |

**Lesson reply** (`lessonReplySchema`, what the model returns): `title`, `explanation`, `keyTerms`, `sources`, `diagram`.

**Saved lesson** (`lessonSchema`): the reply plus `id`, `topic`, `createdAt`, `provider` (`claude` or `codex`), and optional `courseId` and `topicId`. Only sources whose URLs passed the check are kept.

**Outline reply** (`outlineReplySchema`): `title` and modules with topics. The model never supplies ids. The server counts the topics after parsing (over 12 is an `INVALID_OUTPUT` error) and assigns random ids.

**Saved course** (`courseSchema`): id, the prompt it came from, `createdAt`, modules and topics with ids, and `progress.topicId` (the topic last opened, or null).

**Saved module quiz** (`moduleQuizSchema`): course and module ids, the source topic ids, creation time, up to five questions with server-assigned ids, prompts, sample answers and explanations, aggregate `attempts`, `bestSelfRated` and `lastSelfRated` counts, and a bounded window of up to 256 unique opaque `attemptIds` for idempotent retries. A retry older than the window is treated as a new attempt. No typed answers are part of the schema.

**Stored where:** one JSON file per lesson under `DIAGRAMS_DIR/lessons`, one per course under `DIAGRAMS_DIR/courses`, and one separate sidecar per module under `DIAGRAMS_DIR/learn-quizzes/<courseId>/<moduleId>.json`. Both path ids match `^[a-zA-Z0-9_-]{1,64}$`.

## Server

**Routes** (`src/server/routes/learn-courses.ts`, `learn.ts`):

| Method and path                                             | Result                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/learn/courses`                                   | Builds an outline with no web search. 201 with the course.                                                                                                                                 |
| `GET /api/learn/courses`                                    | Summaries, newest first (with a topic count).                                                                                                                                              |
| `GET /api/learn/courses/:id`                                | The course, `builtLessons` (topic id to lesson id) and saved `quizResults` summaries. 404 if missing.                                                                                      |
| `POST /api/learn/courses/:id/topics/:topicId/lesson`        | Returns the saved lesson, or builds one. 201 for the request that built it, 200 for the others. 404 for unknown course or topic.                                                           |
| `PUT /api/learn/courses/:id/progress`                       | Saves the last topic opened. 400 for a topic not in the course.                                                                                                                            |
| `POST /api/learn/courses/:id/modules/:moduleId/quiz`        | Reuses a saved quiz or generates after all module lessons exist. The selected CLI receives course/module titles and lesson explanations and key terms, with tools and web search disabled. |
| `PUT /api/learn/courses/:id/modules/:moduleId/quiz/results` | Accepts a self-rated count only; the sidecar records attempts, best and last counts.                                                                                                       |
| `GET /api/learn/lessons/:id`                                | One lesson. 404 if missing.                                                                                                                                                                |
| `POST /api/learn/lessons`                                   | Builds a standalone lesson for a topic. No UI calls it yet.                                                                                                                                |

**Lesson builder** (`src/server/learn/lesson.ts`): `buildLesson` asks the provider with `{ webSearch: true }`, parses the reply, runs the source checks, drops failing sources, and throws `INVALID_OUTPUT` when no source remains. The prompt puts the topic inside tags and asks for web research.

**Outline builder** (`src/server/learn/outline.ts`): no web search. Its prompt includes only the topic.

**Source checks** (`src/server/learn/sources.ts`), for every source URL in a lesson:

- The URL must be `https`, at most 200 characters, with no username or password.
- The server resolves the host name and requires every address to be public. Private, loopback, link-local, multicast and reserved ranges are refused, IPv4 and IPv6, including the `2001:db8::/32` documentation range and the `fe80::/10`, `fec0::/10`, `fc00::/7` and `ff00::/8` prefixes.
- The request connects to the address that was checked (pinned through `node:https` with a lookup override), so a second DNS answer cannot redirect it (DNS rebinding).
- Timeout 8 seconds. At most 3 redirects, and every redirect target is checked again.
- The response must be 200 with content type `text/html` or `text/plain`. The page body is not kept.
- The request carries only the address and two headers: a fixed `accept` header and the HTTP library's standard headers.
- A failed source is dropped. The reply says how many were dropped; the saved lesson does not keep that count.

**Codex refusal.** A lesson build needs web search, which Claude offers as `WebSearch,WebFetch`. Codex cannot be limited to web search alone, because its shell tool stays available. A lesson request made while Codex is the default tool is refused with the message "Lessons need Claude Code. Codex cannot be limited to web search alone yet." and nothing is sent.

**Concurrency.** Two requests that open the same topic at the same time share one build. A map of in-flight builds, keyed by course and topic, holds the running promise. A second request waits for it. The temporary file name for each JSON write is random, so two writes to one record cannot rename each other's file. Two progress saves at the same moment both succeed and leave one of the saved topics.

Quiz generation requests for the same module share one in-flight provider call. Result updates queue per course/module while other modules use independent sidecar files. The quiz call sets `disableTools: true` and `webSearch: false`; Claude runs with `--tools ''`. Codex cannot guarantee its command tool is off, so it refuses that call before starting the CLI.

## Client

- `src/client/learn/LearnPage.tsx`: the topic form, the time note ("Building a course outline can take a minute or more. Building a lesson uses web research, which can take longer."), the course list with **Try again** on failure.
- `src/client/learn/CoursePage.tsx` and `CourseOutline.tsx`: modules, topics, **Continue**, **Open lesson**, **Try again** per topic, **Practice module** when every lesson in a module is built, and saved result summaries after reload. A failed course load has **Try again**; focus moves to the page heading on retry.
- `src/client/learn/ModuleQuiz.tsx`: local answer draft, sample answer reveal, self-rating, result retry and keyboard focus on the active question or saved result. The API receives only the aggregate count.
- `src/client/learn/LessonView.tsx`: loading, ready, missing (404) and failed states. Back link goes to the course when the lesson belongs to one, otherwise to the Learn tab. The diagram is described in plain words for screen readers (`describe-diagram.ts`).
- `src/client/learn/LessonPanel.tsx`: explanation paragraphs, key terms, sources. Only `https` links are made clickable; a malformed or unsafe address is shown as plain text. Links open in a new tab with `noopener noreferrer`.
- `src/client/learn/LessonCanvas.tsx`: a read-only Excalidraw canvas (`viewModeEnabled`), lazy-loaded. Uses the editor's menu and drawing options. Fits the full drawing to the canvas once.
- `src/client/lib/learn-api.ts`: the calls the pages use.
- `src/client/lib/route.ts`: `#/learn`, `#/learn/<id>`, `#/course/<id>` with id validation.

## Build-up (the step-by-step drawing)

Implemented in `build-steps.ts` (planner), `playback.ts` (reducer), `usePlayback.ts` (timer), `lesson-scene.ts` (scene elements), `BuildControls.tsx` (controls).

- **Order.** Nodes come in topological order. Ties go to the earlier declaration. A cycle takes its earliest unplaced node. One node per step by default.
- **Groups.** A group's frame appears with its first node.
- **Edges.** An arrow appears once both of its ends are shown.
- **Scene.** Each step writes the whole visible scene with `updateScene`, so the scene is a pure function of the step count.
- **Timing.** One step every 1.2 seconds. Playback starts only once the canvas is on screen.
- **Controls.** Replay, Back, Play or Pause, Next, Skip to end, and "Step n of N" (silent while playing, announced when paused). A separate status message says "The build is complete." when the last step appears. Left and Right arrow keys step only while focus is on the controls.
- **Reduced motion.** The full diagram appears at once, nothing auto-plays, and Play is disabled. Next and Back still step through the diagram.
- **Privacy.** Playback runs in the browser. It sends nothing and stores nothing. The position is not kept between visits.

## Known limits (from review rounds, not yet fixed)

- **Codex cannot build lessons or module quizzes.** Lesson calls need limited web tools; quiz calls require all tools off. Codex's command tool cannot currently be disabled for either request.
- **Lesson build time is unmeasured.** A build can take 80 seconds or more at high effort, which is close to the 120-second `AI_TIMEOUT_MS` default. No real build has been timed.
- **Failed lesson load on the lesson page has no retry.** Retry exists on the course page only. This was deferred in the plan.
- **A build that never finishes blocks later opens of that topic** until the server restarts. Source checks have no lookup timeout (the DNS lookup can still hang). This predates the Learn branch.
- **Two tabs saving progress**: the last save wins.
- **Orphan temporary files** from a crashed write are not swept. They are unreadable, so they do not affect results.
- **The course page reads every lesson file** to find which topics are built (topics times lessons reads). Fine for 12 topics; a concern for larger courses.
- **Per-step scene rebuilds.** Every build-up step gives every element a new id (`regenerateIds`), which may flicker and adds one history entry per step in a real browser. Not verified in a browser.
- **No error boundary** around lazy chunks, the same as the editor.
- **No way to delete a lesson or course** from the app. Delete the JSON file in `DIAGRAMS_DIR` by hand (PRIVACY.md says so).
- **Tests.** A progress-save test would still pass if the temporary-name fix were reverted. The lesson-switch remount has no test. The learn e2e spec runs the layout checks at 390px (light and dark) and 1440px (light) only.
- **Excalidraw view-mode behaviour** is covered by test doubles in unit tests. Real-browser behaviour was checked only by screenshots and e2e.
