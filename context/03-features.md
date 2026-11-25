# 3. Features

Each section says what the feature does for the owner, where the code is, and its known limits. Status is "done" unless marked otherwise. Learn has its own file: [04-learn-feature.md](04-learn-feature.md).

## Drawings and editor

**Does.** The Drawings tab lists drawings. The owner can create, open, rename, duplicate, delete and import `.excalidraw` files. The editor autosaves after a short pause and shows saved or unsaved. The mouse wheel zooms the canvas. Two drawing styles exist, hand-drawn (default) and clean ("architect"), with dark mode. The File menu exports PNG, SVG or `.excalidraw`, imports a `.excalidraw` file as a new drawing, and imports or exports a shape library.

**Where.** `src/client/diagrams/` (list), `src/client/editor/` (editor, autosave, menus, export, library sync, wheel zoom, drawing options). Server: `routes/diagrams.ts`, `storage/diagram-store.ts`.

**Limits.** Drawings are single-user files with no sharing or sync. Names are validated and cannot leave the data folder.

## Assistant

**Does.** A prompt box sits at the bottom of an open drawing. Its mode menu chooses:

- **Edit this drawing**: the model adds shapes, adds arrows and deletes shapes. Each reply is applied as one step, so one undo reverts the whole reply. Requests that point at unknown shapes are dropped, and the reason is shown.
- **New diagram**: turns a sentence into a diagram. The model may choose rounded boxes, ellipses, diamonds or notes, colours with meaning, dashed or plain arrows, group frames, a left-to-right or top-down layout, and a title. It never gives coordinates; ELK computes the layout. The owner adds the result to the drawing, or replaces the drawing (replace asks first).
- **Explain** (the `+` button): explains the selected shapes and changes nothing.

Model output is validated against schemas and drawn as text. The assistant uses the provider chosen on the AI tools page.

**Where.** `src/client/ai/assistant/`, `src/client/ai/apply-ops.ts`, `src/client/ai/layout.ts`, `src/client/ai/skeleton.ts`, `src/client/ai/toolSummary.ts`. Server: `routes/ai.ts` (`/generate`, `/chat`), `ai/chat.ts`, `ai/prompts.ts`, `shared/chat-schemas.ts`.

**Known limits.**
- Arrows to shapes that already existed are drawn between them but not glued, because Excalidraw binds arrows only to shapes created in the same change. Arrows between new shapes are glued.
- The chat cannot relabel existing shapes.
- An arrow to a note is not glued to it, because notes are text.

## AI tools page

**Does.** The **AI tools** tab shows, for each tool (Claude Code, Codex), the account it is signed in to (the email, plan and workspace the CLI reports), its state, and the model and effort in use. The owner picks a model and effort, presses **Save**, and picks which tool the assistant uses. **Sign in** starts the CLI's login. Codex shows a link and a code to enter. Claude Code shows a link.

**Where.** `src/client/ai/account/` (`AiAccountPage.tsx`, `AccountCard.tsx`, `SignInSection.tsx`, `ModelControls.tsx`). Server: `routes/ai-account.ts`, `ai/account/`, `ai/settings-store.ts`, `ai/selection.ts`, `shared/ai-account.ts`.

**Limits.** Each sign-in and status check starts a CLI process, so a status view can take a few seconds. The app stores only the choice of tool, model and effort, never credentials. Effort levels are `low`, `medium`, `high`, `xhigh`, `max`, `ultra` (`shared/ai-account.ts`); what a tool accepts depends on its model.

## Architecture maps

**Does.** On the **Architecture** tab, the owner picks a project (an arch project from `ARCH_PROJECTS`, or an uploaded or imported project) and maps it. The map shows:

- each folder as a box, packages (external dependencies) as ellipses, and links with the number of imports behind each one;
- boxes inside dashed frames for their top-level folder.

Selecting a box opens an inspector: what it depends on, what uses it, its files, and **Copy file list**. Boxes can be moved, and **Save layout** keeps the positions for the next scan. **Re-scan** reads the project again and lists what changed. **Reset layout** returns to the automatic arrangement.

**Findings.** Deterministic findings, computed without AI, with kinds `cycle`, `orphan`, `hub`, `large-folder` and `deep-nesting`. Thresholds (`shared/arch-findings.ts`): a hub has 8 or more links in one direction (incoming or outgoing), a large folder has 60 or more files, and nesting deeper than 6 levels is flagged. Findings have a stable id and a severity (high, medium, low).

**AI review.** Runs over the computed findings and metadata only, never file contents. The result is stored as `<name>.arch-review.json` and validated when read.

**AI naming.** **Name with AI** gives folders short names and one-line descriptions. It sends folder names, file base names and links, never file contents. It changes names and descriptions only, never links.

**Scanner.** `src/server/arch/` reads TypeScript and JavaScript only. `scan-ts.ts` uses `dependency-cruiser` to find imports. It skips `node_modules`, build and hidden folders, and never follows packages. Limits per scan: at most 5,000 source files (`MAX_SCAN_FILES`), a 120-second scan timeout (`SCAN_TIMEOUT_MS`), and at most 200 folder boxes in the model (`ARCH_LIMITS.maxComponents`, counted at the model depth, default 2). The model also holds at most 800 links (`maxEdges`), 50 members per box (`maxMembers`), and 1,000 saved layout positions (`maxLayoutEntries`).

**Where.** `src/client/arch/` (page, inspector, findings, review, naming, layout capture, rendering). Server: `routes/arch.ts`, `arch/` (`collect-files.ts`, `scan-ts.ts`, `build-model.ts`, `findings.ts`, `review.ts`, `naming.ts`, `diff.ts`, `projects.ts`), `storage/arch-store.ts`.

**Limits.** TypeScript and JavaScript only. The map cannot read a folder that is not in `ARCH_PROJECTS` or uploaded. The side panel can cover the right edge of a large map.

## Code projects

**Does.** On the Architecture tab, under **Code projects**, the owner uploads a project folder or a zip file, or imports a public GitHub branch. The privacy notice must be ticked first. Package, build, cache and version-control folders are skipped without being listed. Folder uploads skip files over 1 MB. Zip uploads are read into memory by the browser. Limits (`src/shared/project-rules.ts`): at most 5,000 files kept per upload; at most 50 MB of kept files; zip archives up to 60 MB; oversized files are only listed as metadata, up to 256 KB and 1,000 entries; paths up to 300 characters and 24 segments. Credential, key, lock and binary files are never kept, and text that matches known credential formats is left out. Plain-text passwords are not detected.

**GitHub import.** Downloads a public repository branch as a zip from `codeload.github.com`. No token. Redirects are followed only inside `codeload.github.com`. This is one of the server's outbound requests; see [09-privacy-and-security.md](09-privacy-and-security.md).

**Where.** `src/client/projects/`, `src/server/projects/` (`intake.ts`, `github.ts`, `store.ts`, `arch-projects.ts`), `routes/projects.ts`. Storage under `PROJECTS_DIR`, one folder per project with a `manifest.json` written last.

## Math

**Does.** In the editor header the owner can insert:
- axes, a number line and a table (`src/client/math/insert-template.ts`, `templates.ts`);
- LaTeX formulas, through a formula dialog. The server renders LaTeX to a standalone SVG with MathJax (`POST /api/math/render`). The formula is inserted as an image label, and the LaTeX source stays editable.

**Where.** `src/client/math/` (`FormulaDialog.tsx`, `insert-formula.ts`, `insert-template.ts`, `templates.ts`), `src/server/math/render-formula.ts`, `routes/math.ts`.

**Limits.** Formulas are images, so they cannot be edited as shapes. SVG output is sanitised before use.

## Shape library

**Does.** A library of reusable shapes, kept in `library.json` under `DIAGRAMS_DIR` and synced with the editor (`GET /api/library`, `PUT /api/library`). The owner can import and export the library from the File menu.

**Where.** `src/client/editor/library-sync.ts`, `routes/library.ts`, `storage/library-store.ts`.

## Tour

**Does.** The first visit opens a short walkthrough of the whole site. **Take the tour** at the top of the main pages, or **Tour** in a drawing, reopens it. Escape or **Skip tour** closes it.

**Where.** `src/client/tour/` (`tour-steps.ts` and the tour component). Step text must match the four tabs (Drawings, Learn, Architecture, AI tools).

## Navigation

Four top-level tabs in one header (`src/client/nav/PageHeader.tsx`): Drawings, Learn, Architecture, AI tools. A map's **Back** link returns to Architecture. A drawing's back link returns to Drawings.

## Learn

Learn has its own file: [04-learn-feature.md](04-learn-feature.md). In short: a topic becomes a course outline, opening a topic builds a lesson (a step-by-step diagram, an explanation, key terms and checked web sources), and courses remember the last topic opened.
