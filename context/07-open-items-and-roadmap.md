# 7. Open items and roadmap

This file lists what is not done, in four groups: planned work, blocked work, follow-ups from reviews, and housekeeping. Each item names where it is recorded.

## Planned work

### Learn phase 5: optional module quizzes (implemented)

Implemented on `feat/learn-module-quizzes`. A completed module offers up to five short-answer questions. The learner reveals a sample answer and self-rates; aggregate attempts, best and last counts plus up to 256 recent opaque attempt ids for retry deduplication are stored locally. An older delayed retry is treated as new. Typed answers are never sent or saved. The action is optional and does not gate navigation or progress. Codex is refused because its command tool cannot be guaranteed off.

### Learn phase 6: bigger local courses (future)

After Phase 5 merges, raise local course limits from 8 modules and 12 topics to 12 modules and 24 topics total, keeping the 12-topic per-module cap. No hosted quotas: the app has no account or paid-plan identity. Follow the performance gate in the Learn plan before changing these limits.

### Learn: delete a course or lesson

Not built. The privacy policy and the Learn page say to delete the JSON file by hand. A delete button is a product change and needs its own privacy wording.

### Other future ideas from `docs/PLAN.md`, "Later"

- Python import scanning (`pydeps` or `ast`), Go (`go list -deps`), docker-compose and Kubernetes manifests as infrastructure nodes.
- Ollama as a third AI provider for offline use (a third adapter, behind the `AiProvider` interface).
- Obsidian or Markdown export of architecture notes.

### Social link

The owner's X (Twitter) link was to be added to the project links (`src/client/lib/project-links.ts`) once the owner gives the handle. Not added. Do not invent a handle.

## Blocked work

### Architecture review phase 6: deep review with file contents

From `docs/plans/2026-11-23-architecture-review-github-and-math.md` (untracked). Marked **BLOCKED**. It would send file contents, not just metadata, to the AI, which changes the privacy position. Do not start it without a fresh decision from the owner and an update to PRIVACY.md.

### Learn phase 7: hosted subscription (future track, not planned)

Hosted model access sold as a monthly plan. Prerequisites: written approval or a commercial agreement from each model provider; accounts; payments; a new privacy policy, because sraww would hold keys and user content; consumer-law review (EU withdrawal rights, UK subscription rules); cost per lesson measured from real use. Not started until the prerequisites are met.

### Codex lessons

Codex cannot build lessons while its shell tool stays available for a web call. Unblock only if Codex can run with its command tool removed. Until then, a lesson request while Codex is the default is refused.

## Follow-ups from reviews (not yet fixed)

These come from the review rounds for PRs #11 to #16. None is a known data-loss or security bug. Each is a defect or a risk.

**Learn, reliability**

- A failed lesson load on the lesson page has no retry. The plan defers it. Retry exists on the course page.
- A build that never finishes blocks later opens of that topic until the server restarts. Add a timeout for lesson builds.
- Source checks have no timeout on the DNS lookup itself. The request timeout (8 seconds) does not cover it.
- Temporary files left by a crashed write are never swept. Add a sweep at startup or when listing.
- A lesson build may exceed `AI_TIMEOUT_MS` (120 seconds) at high effort. No real build has been timed. Measure before changing the default.
- Two tabs saving progress: the last save wins. Acceptable for one user; note it if multi-tab use grows.

**Learn, code quality**

- The course page reads every lesson file to find which topics are built. Fine for 12 topics, a cost for larger courses.
- The server route `POST /api/learn/lessons` (a standalone lesson) has no UI caller. Either give it a use or remove it in one change.
- No error boundary around lazily loaded chunks (the editor and the lesson canvas). A chunk failure shows a blank area.
- Each build-up step rebuilds the scene with new element ids (`regenerateIds`). This may flicker in a real browser and adds one undo entry per step. Needs stable ids to fix. Verify in a browser first.
- `Play` at the end of a build restarts it, so it works as a second Replay. Decide whether that is wanted.
- The Play button is disabled under reduced motion with no reason shown. Add a hint.
- `matchMedia` for reduced motion is read once per page load. A change to the system setting is not picked up until reload.

**Learn, tests**

- The lesson-switch remount (`key={lesson.id}` on the canvas) has no test.
- Some build-up tests count elements rather than checking which ones appear at each step.
- The progress-save concurrency test would still pass if the temporary-name fix were reverted.
- The Replay step of the build-up e2e test checks the count straight after the click. It polls, so it only fails if the page stalls longer than one step (1.2 seconds).
- The learn e2e spec's layout checks cover 390px (light and dark) and 1440px (light). Dark at 1440 is not covered.

**Editor and other areas**

- `Editor.test.tsx` > "shows a retry button when saving fails" is flaky under load (it failed once in a full run and passed alone). Fix the timing in the test, not the editor.
- The assistant's arrows to shapes that already existed are not glued. Excalidraw binds arrows only to shapes created in the same change. This is a known limit in the README.
- A note cannot take a glued arrow. Known limit.
- The assistant cannot relabel shapes that already existed. Known limit.

## Verification not yet done

- **Real browser checks for Learn:** dark theme for the build-up controls, a lesson with groups, notes and a title, reduced motion at 390px and 1440px. Only unit tests and light-theme e2e have run.
- **Lesson build time:** not measured. The "a minute or more" note in the UI is an estimate, not a measurement.
- **Full e2e suite:** not run since the Learn work began. Only `e2e/learn.spec.ts` ran after each change. The full unit suite did run after Phase 4 (656 tests passed in the latest run; one test is known to be flaky under load; the exact count drifts, so rerun `npm test` for the current number). Run `npm run test:e2e` before the next release.
- **Architecture findings and AI review on real projects:** tested with fixtures. Not checked on a large real project.

## Housekeeping

- `docs/PLAN.md` still says "PLAN ONLY — not started". Update its status line, or add a note at the top that it is the original plan.
- The Learn plan (`docs/plans/2026-11-24-visual-learning.md`) still describes the outline as "with research" in its Phase 2 text. The outline uses no web search. The plan's Phase 2 section should say so. Phase 3 and Phase 4 notes are current.
- `feat/one-command-start` (commit `5c9cba9`, "one-command local start and a 30-second demo script") is not pushed and not merged. Push and open a pull request only when the owner asks.
- `stash@{0}` ("assistant work before PR") holds about 12 changed files, including the assistant and its test. It has not been reviewed. Check it before doing anything else with it.
- Local branches that are merged into `main` can be deleted when the owner agrees. The list is in [06-history.md](06-history.md).
- The effort default in code does not match the Learn product decision (see [05-decisions.md](05-decisions.md)). Decide and align.
- The two untracked planning documents in `docs/` are not committed. Ask the owner before committing them.
- `context/` is new. Keep it current (see [README.md](README.md)).
