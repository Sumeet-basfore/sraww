# 10. Working agreements

These are the rules the owner has set, and the process that has worked. Where a rule came from an instruction, the source is named. Follow them unless the owner changes them.

## Branches, commits and pull requests

- Start from an up-to-date `main`. Work on a feature branch named for its change: `feat/<topic>`, `fix/<topic>`, `docs/...`. One branch per phase or per feature.
- Commit messages use the conventional types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Describe the change in the body when it is not obvious.
- **No `Co-Authored-By` line** in commits. The owner's `CLAUDE.md` forbids it unless the project's `.claude/settings.json` sets `attribution.commit`. That file does not exist here. Eleven older commits carry one anyway. Do not rewrite history to remove them.
- Pull request bodies: a `## Why` section first, then what changed, the decisions made and why, the verification with exact result lines, and what was **not** verified. End with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)` if the tool requires it.
- **Push and open a pull request when the owner asks, or when a phase or fix is ready to review.** The owner asked for one pull request per phase. Do not push unrelated branches (`feat/one-command-start` is unpushed on purpose).
- Merge only after review (below), and pin the merge to the reviewed commit (`expectedHeadSha`). After a merge, update local `main` with a fast-forward pull.

## Review

- Reviews for the Learn phases ran on DeepSeek V4.1 Flash through the `pi` harness, as instructed by the owner. The earlier reviewer (GPT-6 Luna) was replaced by the owner's instruction. Use the owner's current instruction if it differs.
- The reviewer works read-only. The brief says so, and forbids edits, commits, pushes and destructive or network commands. Give the reviewer the diff range, the purpose of the change, and the areas to check. Do not give it your conclusion; it should form its own.
- Review severities (the owner's review rule): CRITICAL blocks the merge; HIGH should be fixed before merging; MEDIUM is fixed when cheap and low-risk, otherwise noted; LOW is optional. Fix small findings yourself, and disclose anything that is deferred.
- Re-review fix commits when the fixes change behaviour. A fix that only changes tests or wording may be checked by running the tests instead. Say which in the pull request.
- The runtime mode for the `pi` reviewer is `full-access`, because `pi` has no automatic mode. The safety rule is therefore written, not enforced: no destructive or network-changing commands. Disclose this when it matters.

## Delegation to subagents

- Use the `poteto-agent` subagent type for code work, with effort `xhigh`. Its first line must be `Read /home/sumeet/.claude/skills/poteto-mode/worker.md before anything else.` (this rule comes from the owner's skill set). Its model cannot be pinned and runs on Opus. Say so in reports.
- Brief a subagent with the goal, the files to read, the constraints (no commit, no push, files untouched, no co-author line), and the exact verification to run. Ask for a short report with the verification output.
- Review the subagent's diff yourself and run the checks yourself before committing. Its summary is not evidence.
- Fresh subagents for each fix round, with the original brief and the reports. Resume an old one only when its working state is needed.
- Small review fixes are done directly, not by a new subagent.

## Code rules (from the owner's global `CLAUDE.md` and rules)

- Read a file before editing it. Prefer editing existing files to creating new ones.
- Keep files under 500 lines (the project `CLAUDE.md` limit). The style rules suggest 200 to 400 lines, and 800 at most.
- Validate input at every system boundary (requests, files, model output).
- Immutability by default: build new values rather than mutating.
- Errors are handled explicitly and shown to the user in plain words. No silent swallowing; a `catch` that deliberately ignores an error says why.
- Tests come with the change. Test behaviour that users or callers can observe, not internals.
- Comments are short and say why, not what. Do not write comments that restate code.
- Never commit secrets or `.env` files. The repo ignores `.env` and `data/`.
- Do not add API keys or provider SDKs (see [09-privacy-and-security.md](09-privacy-and-security.md)).

## Untracked files

Two planning documents in `docs/` are untracked and belong to the owner:

- `docs/IDEAS-arch-and-math.md`
- `docs/plans/2026-11-23-architecture-review-github-and-math.md`

Do not commit, edit, move or delete them without asking. Leave them out of `git add`.

## Verification before a commit or a pull request

1. `npm run typecheck` passes.
2. ESLint passes on the changed files.
3. Prettier check passes on the changed files.
4. The affected unit tests pass, and the full unit suite when shared code changed.
5. The e2e spec for the changed flow passes when a page or flow changed.
6. Privacy text still matches the code.
7. The context file for the area is updated (see [README.md](README.md)).

Report exact results. Never claim a pass you did not see. Say what you could not verify (for example a real browser check that was not run).

## Shell and tools

- Use the dedicated file tools (Read, Edit, Write) instead of shell output for file content.
- Long commands may be slow under load. A test that fails under load is rerun alone before anything else changes (see [08-testing-and-quality.md](08-testing-and-quality.md)).
- Avoid broad process kills. An earlier broad `pkill` killed the owner's own dev sessions; kill only the processes you started.

## Owner preferences that shaped the work

- Plain-language interface. No jargon in the UI.
- Accessibility matters: focus after actions, screen-reader announcements that are not noisy, reduced motion respected.
- Honest copy. No invented numbers or time estimates. Privacy text is checked claim by claim.
- Small, reviewable pull requests, one per phase, with the reasons written down.
- Ask before anything hard to reverse or visible to others (pushing, merging, deleting, committing the untracked docs, posting to external services).
