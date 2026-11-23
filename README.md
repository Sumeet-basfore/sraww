<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/sraww-primary-dark.svg">
  <img src="assets/sraww-primary-light.svg" width="260" alt="sraww">
</picture>

# sraww

A local, single-user whiteboard in the style of Excalidraw. Drawings are plain `.excalidraw` files on your disk. It adds AI help that uses your existing Claude Pro and ChatGPT Plus subscriptions through their command-line tools, and an architecture map that draws how the folders of a project depend on each other.

Nothing is sent anywhere except through the Claude Code and Codex CLIs you already run. The app holds no API keys and no accounts.

## Requirements

- Node.js 22.9 or newer
- [Claude Code](https://docs.claude.com/claude-code) (`claude`) logged in with your Claude Pro account, for the Claude option
- [Codex CLI](https://github.com/openai/codex) (`codex`) logged in with your ChatGPT Plus account, for the Codex option
- Chromium, only for the browser tests: `npx playwright install chromium`

Check the logins with `claude auth status` and `codex login status`. The app shows the same status in the AI panels.

## Setup

```bash
npm install          # also copies Excalidraw's fonts into public/fonts
cp .env.example .env # optional; the defaults work
```

## Run

Development (editor on http://127.0.0.1:5173, API on port 4317):

```bash
npm run dev
```

Production-style (one process, everything on http://127.0.0.1:4317):

```bash
npm run build
npm start
```

The server listens on `127.0.0.1` only and rejects requests whose Host or Origin is not local.

## Configuration

| Variable                       | Default                   | Meaning                                                              |
| ------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `PORT`                         | `4317`                    | Server port                                                          |
| `DIAGRAMS_DIR`                 | `./data/diagrams`         | Where drawings, architecture models and layouts are saved            |
| `AI_PROVIDER`                  | `claude`                  | Default tool, `claude` or `codex`                                    |
| `CLAUDE_BIN` / `CODEX_BIN`     | `claude` / `codex`        | Command names or paths of the CLIs                                   |
| `CLAUDE_MODEL` / `CODEX_MODEL` | empty                     | Optional model override; empty uses each CLI's default               |
| `AI_TIMEOUT_MS`                | `120000`                  | How long one AI call may run                                         |
| `AI_WORKDIR`                   | `./data/ai-workdir`       | Empty folder the CLIs run in (they cannot see your projects)         |
| `AI_SETTINGS_FILE`             | `./data/ai-settings.json` | Where the AI tools page saves the chosen tool, model and effort      |
| `ARCH_PROJECTS`                | empty                     | Comma-separated **absolute** folders that architecture maps may read |

## Using it

**Drawings.** Create, open, rename, duplicate, delete and import `.excalidraw` files from the start page. Edits save automatically after a short pause, and the status line shows whether everything is saved. Export a drawing as PNG, SVG or `.excalidraw` from the editor's Export menu.

**AI generate.** “Generate” turns a sentence into a diagram. The model returns shapes and links only; the layout is computed by ELK. You can add the result to the drawing or replace the drawing (replace asks first).

**AI chat.** “Chat” edits the open drawing. The model may add shapes, add arrows and delete shapes, and every change is applied as one step, so Ctrl+Z undoes a whole reply. Requests that point at unknown shapes are dropped and the reason is shown. “Explain selection” describes the selected shapes and changes nothing.

**AI tools.** Open **AI tools** from the start page. It shows the account each tool is signed in to (the email, plan and workspace the CLI reports), the model and effort it uses, and which tool answers Generate and Chat. Pick a model and effort and press **Save**. If a tool is signed out, press **Sign in**. Codex shows a link and a code to enter on its sign-in page. Claude Code shows a link, and you paste the code it gives you back into sraww. sraww never sees your password.

**Architecture maps.**

1. Add the folders you want mapped to `ARCH_PROJECTS` in `.env`, then restart the server.
2. On the start page, pick a project, name the map and choose **Map project**.
3. The map shows each folder as a box, packages as ellipses, and links with the number of imports behind each one. Boxes sit in dashed frames for their top-level folder.
4. Select a box to see what it depends on, what uses it, and its files. **Copy file list** copies its paths.
5. Move boxes as you like, then **Save layout** so the next scan keeps them. **Re-scan** reads the project again and lists what changed since the last scan. **Reset layout** returns to the automatic arrangement.
6. **Name with AI** gives folders short names and one-line descriptions. It sends folder names, file base names and links, never file contents. It changes names and descriptions only, never the links.

## Tests

```bash
npm test               # unit and component tests (Vitest)
npm run typecheck
npm run lint
npm run test:e2e       # browser tests (Playwright); builds and starts a test server
```

The browser tests use a throwaway diagrams folder and stub the AI endpoints, so they never call a model. The unit tests run the real CLI wrappers against small fake `claude` and `codex` scripts in `tests/fixtures/bin/`.

## Layout of the code

```
src/shared/   schemas shared by server and client (diagrams, AI graphs, chat, architecture)
src/server/   Express API: storage, AI providers and runner, architecture scanner and model
src/client/   React app: editor, list, AI panels, architecture view
tests/        Vitest unit tests, fixtures and fake CLIs
e2e/          Playwright browser tests
docs/PLAN.md  the implementation plan this was built from
```

## Security notes

The full privacy policy is in [PRIVACY.md](PRIVACY.md). In short: nothing is sent to the maintainer, and the only outside traffic is what you send to Claude Code or Codex when you use the AI features.

- The server only answers local requests (Host and Origin checks), and sends a strict content security policy with no framing.
- Diagram and model names are validated and can never leave the data folder.
- The AI CLIs run without a shell, with only `PATH` and `HOME` in their environment, in an empty working folder, with tools disabled (Claude) or a read-only sandbox (Codex).
- Model output is validated against schemas, capped in size, and drawn as text only. Project content is passed to the model as quoted data.
- The architecture scanner reads only folders listed in `ARCH_PROJECTS`, skips `node_modules`, build and hidden folders, and never follows packages.

## Known limits

- Chat arrows to shapes that already existed are drawn between them but not glued, because Excalidraw only binds arrows to shapes created in the same change. Arrows between new shapes are glued.
- Chat cannot relabel existing shapes yet.
- The architecture scanner reads TypeScript and JavaScript only.
- Architecture maps are limited to 200 folders and 5,000 source files per scan.
- AI calls count against your Claude Pro or ChatGPT Plus usage limits. Each call starts a new CLI process, so expect a few seconds of delay per request.
- Check the current terms of Claude and ChatGPT before relying on scripted use of the CLIs.
