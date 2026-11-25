# 6. History

The repository has 99 commits on `main`, from 23 November 2026 (first commit) to 25 November 2026. Every feature below landed through a pull request into `main`. The GitHub repository is the project's `origin`.

## Merged pull requests, in order

| PR | Branch | What it delivered |
| --- | --- | --- |
| #1 | `feat/ai-account-settings-redesign` | AI tools: show each tool's account, choose model and effort, sign in from the app. |
| #2 | `fix/local-assets-and-privacy-policy` | Privacy policy (`PRIVACY.md`) linked from the README. Excalidraw assets served locally. Network privacy test. |
| #3 | `fix/dev-server-blank-page` | Dev server renders again after an Excalidraw font change. |
| #4 | `feat/editor-import-zoom-ai-freedom` | The assistant may use shapes, colours, frames and notes, and relabel shapes. Wheel zoom. Shape library import and export. |
| #5 | `feat/assistant-projects-tour` | Docked assistant, code project uploads, first-visit walkthrough. |
| #6 | `fix/review-round-1` | Review fixes: diagram shapes, assistant, names, uploads, logo. |
| #7 | `feat/assistant-composer` | Prompt-box assistant with tool, model and effort controls. |
| #8 | `feat/arch-review-github-math` | Architecture findings (cycles, orphans, hubs, large folders, deep nesting). AI review over metadata only, stored as a validated sidecar. GitHub branch import (zip from codeload only). LaTeX formulas rendered on the server and inserted as editable image labels. Math templates (axes, number line, table). |
| #9 | `fix/editor-menu-links` | Drawing menu shows sraww's own links instead of Excalidraw's social links. |
| #10 | `feat/stitch-ui` | UI redesign: editor header with menus, paper canvas, floating assistant, start page with two columns, AI tools page with cards, architecture inspector with metrics and findings, focus handling in menus and the inspector. |
| #11 | `feat/learn-mode` | Learn backend: outline, sourced lessons, source checks (https, public addresses, pinned connections, redirect limit), Codex refusal for lessons, privacy text. |
| #12 | `feat/phase0-tabs` | Four top-level tabs: Drawings, Learn, Architecture, AI tools. Architecture and projects get their own page. Map back link returns to Architecture. |
| #13 | `feat/learn-ui` | Learn UI: topic form, lesson page with a read-only diagram, sources and key terms, plain-words diagram description, lesson canvas with the editor's menu, phone layout, end-to-end tests for the Learn tab. |
| #14 | `feat/course-outline` | Course outline (Learn phase 2): course schemas and builder, course store, course routes (outline, topic lessons, progress), client calls, course list and course page, Continue, Last opened. Fixes: one lesson build shared between two tabs; unique temp file per JSON write. |
| #15 | `feat/build-up-animation` | Build-up (Learn phase 3): the step planner, the playback reducer and timer, Replay, Back, Play or Pause, Next, Skip to end, arrow keys scoped to the controls, reduced motion, completion announcement. |
| #16 | `feat/polish-and-privacy` | Learn phase 4: Try again on every failed step, focus on retry, time note, phone and desktop layout checks (light and dark), resume-after-reload e2e test, privacy and README updates. |

The Learn phases were reviewed by DeepSeek V4.1 Flash through the `pi` harness, as the owner instructed. The reviewer for earlier PRs is not recorded in this folder; check the PR threads on GitHub.

## Learn plan progress

From `docs/plans/2026-11-24-visual-learning.md`:

| Phase | Plan | Status | PR |
| --- | --- | --- | --- |
| 0 | Tabs | Done | #12 |
| 1 | Sourced lessons (backend and UI) | Done | #11, #13 |
| 2 | Course outline and progress | Done | #14 |
| 3 | Build-up animation | Done | #15 |
| 4 | Polish, privacy and tests | Done | #16 |
| 5 | Quizzes | Not started (future) | - |
| 6 | Bigger courses and plan limits | Not started (future) | - |
| 7 | Hosted subscription | Future track, blocked on provider approval | - |

## Other planning documents

- `docs/PLAN.md`: the first plan (scope, decisions D1 to D12, phases 0 to 9). It still reads "PLAN ONLY — not started". The app has since been built well beyond it. Use it for decisions and scope, not for status.
- `docs/plans/2026-11-23-architecture-review-github-and-math.md` (untracked): the plan for architecture findings, AI review, GitHub import, math and the LaTeX labels. Phases 1 to 5 have landed in PR #8. Phase 6 (deep review with file contents) is marked BLOCKED and is not built.
- `docs/IDEAS-arch-and-math.md` (untracked): the idea memo that preceded that plan.

Both untracked files stay out of git until the owner decides otherwise.

## Branches and stashes not in `main`

| Name | State | Note |
| --- | --- | --- |
| `feat/one-command-start` | One commit, `5c9cba9` ("one-command local start and a 30-second demo script"), not pushed | Not merged. Push and open a pull request only when the owner asks. |
| `feat/initial-build` | Local branch, already an ancestor of `main` | Safe to delete when the owner agrees. |
| Other feature branches | Merged. Some also exist on `origin` | Safe to delete when the owner agrees. |
| `stash@{0}` ("assistant work before PR") | Holds a change of about 12 files, including the assistant and its test | Not reviewed by this context. Do not drop it without checking what it contains. |

## Decisions that changed over time

- **Push policy.** The first instruction was no `git push` until the owner asked. The owner then asked for a pull request per phase, and those are pushed.
- **Reviewer.** Reviews first used GPT-6 Luna, then the owner switched them to DeepSeek V4.1 Flash through `pi`.
- **Commit trailers.** The owner's rule forbids `Co-Authored-By`. Some commits still carry one (see [05-decisions.md](05-decisions.md)).
- **Codex lessons.** First attempted with a `--search` flag and a disabled shell tool. The shell tool could not be removed, so Codex now refuses lesson builds.
- **Source checks.** The first version resolved the host name twice, once to check and once to connect, so a second answer could point the request somewhere else. Review found this. The connection is now pinned to the address that was checked, and every redirect target is checked again.
