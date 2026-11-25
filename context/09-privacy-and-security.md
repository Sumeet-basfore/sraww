# 9. Privacy and security

The public policy is `PRIVACY.md` at the repo root. The app serves it at `/PRIVACY.md`. This file is the internal summary: the rules that must not break, and the list of what leaves the machine. When code changes an outbound request or a stored file, update `PRIVACY.md` in the same change, and check each claim against the code.

## The rules that must not break

1. **Local only.** The server listens on `127.0.0.1`. The local-only guard checks the Host and Origin headers on every request (`src/server/guard.ts`).
2. **No API keys, no accounts, no provider SDKs.** AI runs only through the owner's logged-in `claude` and `codex` CLIs. Never add an API key variable or an SDK that calls a model directly.
3. **The CLIs run in a bare environment.** Only `PATH` and `HOME` are passed, and the working folder is the empty `AI_WORKDIR`, so a CLI cannot read the owner's projects by default.
4. **Least tools per call.** Outline and most calls get no tools (`--tools ''` for Claude). The one web-enabled call (a lesson) gets only `WebSearch` and `WebFetch`. Codex cannot be limited this way, so it refuses web-enabled calls.
5. **Model output is data.** It is validated against zod schemas, capped in size, and drawn as text. Formula SVG is sanitised. Nothing in model output is executed.
6. **User content is quoted, not obeyed.** Prompts wrap user content in tags, and the tags are stripped from the content first, so user text cannot close them.
7. **Ids are checked before they become file names.** A request cannot reach outside its data folder.
8. **Source checks are strict.** Lesson source URLs must be https, at most 200 characters, with no credentials. Every address must be public. Connections are pinned to the checked address. Redirects are limited to 3, and each target is checked again. Responses must be HTML or plain text. Timeout 8 seconds.
9. **Architecture AI review and naming send metadata only.** Folder names, file base names, links and computed findings. Never file contents. The file-contents review (architecture plan phase 6) is blocked until the policy changes.
10. **Uploads are filtered.** Package, build, cache and version-control folders are skipped. Credential, key, lock and binary files are never kept. Text that matches known credential formats is left out. Plain-text passwords are not detected.
11. **Browser pages load nothing from other websites.** Fonts are copied from the Excalidraw package at install time and served by the app. A test checks the network behaviour (`e2e/privacy.spec.ts`, and the security-headers tests).
12. **A strict Content Security Policy with no framing** is sent by the server.

## What leaves the machine

Only these. If a feature sends something new, add it here and in `PRIVACY.md`.

| Trigger                                                             | What is sent                                                                                                              | Where                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Any AI generation call (assistant, outline, lesson, review, naming) | The prompt, which contains the user's chosen content for that feature                                                     | To the chosen CLI, which talks to its provider under the owner's account      |
| Building a course outline                                           | The topic text and fixed outline instructions. No web search.                                                             | Through the CLI (Claude or Codex)                                             |
| Building a lesson                                                   | The course title and topic title. Web research is allowed for this one call (Claude only).                                | Through Claude Code; the tool may search the web and read pages it chooses    |
| Lesson source check                                                 | The source address and two HTTP headers (`accept`, and the library's standard headers). No topic, drawing or lesson text. | From the sraww server process, straight to the cited address                  |
| GitHub import                                                       | The owner's chosen public repository and branch name                                                                      | To `codeload.github.com`. No token. GitHub sees the request, as any site does |
| Architecture AI review and naming                                   | Folder names, file base names, links, findings                                                                            | Through the chosen CLI                                                        |
| Sign-in to a CLI                                                    | Whatever the CLI's own login flow sends                                                                                   | Sent by the CLI, not by sraww's code                                          |

Nothing else is sent. The browser talks only to the local server.

## What is stored on the computer

- Drawings, architecture models, layouts, reviews, the shape library, lessons and courses: JSON or `.excalidraw` files under `DIAGRAMS_DIR`.
- Uploaded or imported projects: files under `PROJECTS_DIR`, with a manifest.
- AI choices (tool, model, effort): `AI_SETTINGS_FILE`. No credentials.
- Browser preferences (theme, drawing style): `localStorage`. The lesson build-up position is not stored.
- The CLIs keep their own sign-in state. sraww reads its status and does not copy it.

Deleting: drawings and uploaded projects have delete actions in the app. An architecture layout can be reset. Architecture models, reviews, lessons and courses have no delete action; remove their files by hand (lessons and courses are stated in `PRIVACY.md`).

## Known privacy caveats to keep in mind

- For Codex, the shell tool stays available in a read-only sandbox, so Codex can read files on the computer during a call. `PRIVACY.md` says so. Codex is refused for lesson builds because of this.
- The lesson source checks are made by the server, not the browser. They do not appear in the browser's network panel.
- Lesson web research is done by Claude Code's own tools. sraww does not see which pages it reads.
- Uploaded text passed to the AI is limited to what the feature sends (see the table). A plain-text password in an uploaded file is not detected.

## Security-relevant decisions

See [05-decisions.md](05-decisions.md) for the reasons behind the source-check design, the Codex refusal, the metadata-only review, and the bare CLI environment.

## Checklist before merging a change that touches data or the network

- Does it add an outbound request, or change what a request carries? Update the table above and `PRIVACY.md`.
- Does it store a new file? Update "What is stored" and `PRIVACY.md`.
- Does it pass user or project content to a model? Quote it as data, and check the prompt tags.
- Does it accept a new id or name? Validate it before it becomes a path.
- Does the browser load something new? Check it against the no-third-party-loads rule.
