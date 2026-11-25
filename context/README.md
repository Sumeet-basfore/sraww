# sraww context

This folder is the written memory of the project. A new agent, or a person returning after a break, should be able to read these files and understand what sraww is, how it is built, what works, what does not, what is planned, and how work is done here. You should not need to read every source file first.

The code is the final authority. When a document and the code disagree, trust the code, then fix the document.

## Reading order

1. [01-overview.md](01-overview.md): what the app is, the stack, how to run it, and where each feature stands.
2. [02-architecture.md](02-architecture.md): layers, request flow, routes, data on disk, configuration, and the AI provider design.
3. [03-features.md](03-features.md): every feature area, what it does, where it lives, and its known limits.
4. [04-learn-feature.md](04-learn-feature.md): the Learn tab in depth (courses, lessons, sources, build-up, retry).
5. [05-decisions.md](05-decisions.md): decisions already made, with the reasons, and what was rejected.
6. [06-history.md](06-history.md): what was built, in order, with pull request numbers.
7. [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md): what is not done, what is planned, what is blocked, and known follow-ups.
8. [08-testing-and-quality.md](08-testing-and-quality.md): test commands, what each layer covers, and known flaky tests.
9. [09-privacy-and-security.md](09-privacy-and-security.md): the rules that must not break, and where the public policy lives.
10. [10-working-agreements.md](10-working-agreements.md): how to branch, commit, open pull requests, run reviews, and delegate work.
11. [code-inventory.md](code-inventory.md): every tracked source, test and script file with its line count.

## Other documents in the repo

- `README.md` (repo root): the user-facing guide: setup, configuration, how to use each feature.
- `PRIVACY.md` (repo root): the privacy policy. It is served by the app at `/PRIVACY.md`. Keep every claim in it checkable against the code.
- `docs/PLAN.md`: the original plan from the first build. Its status line ("PLAN ONLY") is out of date. It is kept for its decisions, not its status.
- `docs/plans/2026-11-24-visual-learning.md`: the plan for the Learn tab, phases 0 to 7. Phases 0 to 4 are done.
- `docs/plans/2026-11-23-architecture-review-github-and-math.md` and `docs/IDEAS-arch-and-math.md`: planning notes for architecture review, GitHub import and math. They are untracked files in the working tree, not committed. Do not commit or edit them without asking the owner. Most of the plan has since been built (see [06-history.md](06-history.md)).

## Keeping this folder current

- Update the file for an area in the same pull request that changes the area. A feature change that leaves its context file stale is not finished.
- Record each merged pull request in [06-history.md](06-history.md).
- Move an item from [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md) to history when it is done. Do not delete it silently.
- Regenerate [code-inventory.md](code-inventory.md) after files are added or removed. Command: `git ls-files -- src tests e2e scripts | xargs wc -l`.
- Do not write personal details of the owner into these files. They may be pushed to a shared remote.
