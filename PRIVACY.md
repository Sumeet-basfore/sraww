# Privacy policy

Last updated: 2026-11-24

## The short version

sraww runs on your computer. It has no accounts, no analytics, no telemetry, and no servers of its own. Your drawings, settings and uploaded code projects stay in folders on your machine.

When you use an AI feature, the text involved is sent by the Claude Code or Codex command-line tool you installed to that tool's provider (Anthropic or OpenAI), using your own account. Their terms and privacy policies apply to that traffic. sraww cannot see it, and it cannot change it.

The maintainer does not receive any data from your installation.

You do not have to trust this document. Every claim below can be checked in the code, in the browser's network panel, or with the automated test named in [How to check this yourself](#how-to-check-this-yourself).

## What sraww does not do

- It does not ask you to create an account or give an email address.
- It does not collect analytics, crash reports or usage statistics.
- It does not set cookies or load tracking pixels.
- Its pages do not load fonts, scripts or images from other websites. The fonts are copied from the Excalidraw package when you install or build the app, and the app serves them itself.
- It does not hold API keys, passwords or tokens. See [Sign-in and credentials](#sign-in-and-credentials).
- It does not send anything to a server operated by the maintainer. There is no such server.

## What is stored on your computer

Relative paths such as `./data/diagrams` are relative to the folder you start sraww from.

| Data                                               | Where it is kept                                               | Setting             | How to delete it                                                              |
| -------------------------------------------------- | -------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Drawings (`.excalidraw` files)                     | `DIAGRAMS_DIR`, default `./data/diagrams`                      | `DIAGRAMS_DIR`      | Delete the drawing in the app, or delete the folder                           |
| Architecture maps and their layouts                | `DIAGRAMS_DIR`                                                 | `DIAGRAMS_DIR`      | Delete the map in the app, or delete the folder                               |
| AI tool choices (which tool, model and effort)     | `AI_SETTINGS_FILE`, default `./data/ai-settings.json`          | `AI_SETTINGS_FILE`  | Delete the file. It holds no credentials                                      |
| Working folder for the AI tools                    | `AI_WORKDIR`, default `./data/ai-workdir`                      | `AI_WORKDIR`        | Delete the folder. The app removes its temporary files after each request     |
| Uploaded code projects (kept files and a manifest) | `PROJECTS_DIR`, default `./data/projects`                      | `PROJECTS_DIR`      | Click Delete beside the project on the Architecture tab, or delete its folder |
| Excalidraw library (reusable shapes)               | `DIAGRAMS_DIR`, file `library.json`                            | `DIAGRAMS_DIR`      | Delete the file, or remove items in the editor's library panel                |
| Display preferences (theme, drawing style)         | Your browser's local storage, key `sraww.prefs`                | Settings in the app | Clear the site's data in your browser                                         |
| Walkthrough status (seen or not)                   | Your browser's local storage, key `sraww.tourSeen`             | None                | Clear the site's data in your browser                                         |
| Editor drafts (library publishing, Mermaid text)   | Your browser's local storage, written by the Excalidraw editor | None                | Clear the site's data in your browser. We have not confirmed these keys       |

Lessons, when you create them, are saved as one JSON file each under `DIAGRAMS_DIR/lessons`. A lesson holds the topic you asked for, its title, explanation, key terms, diagram and the source addresses it cites. To delete one, delete its file from that folder. The Learn tab has no delete button for this yet.

The drawings, architecture maps, lessons, AI settings and working folder are plain files on your machine. sraww does not upload them anywhere.

The server writes its status messages to its console only. It does not write a log file.

## Sign-in and credentials

sraww never reads, stores or transmits a password, a sign-in token or an API key.

- **Claude Code** and **Codex** each sign you in through their own login flow. They keep the credentials in their own locations, under their own control.
- sraww runs the tools' status and sign-in commands. Checking your sign-in status, listing models and starting a sign-in run those tools' own commands. sraww reads the account details they report: the email address, the plan, the workspace or organisation name, and the sign-in method. It shows these to you and does not store them. Those commands may contact the provider over the network. We have not measured what they send, and they carry no drawings or code.
- Opening a page that shows AI status, such as the drawings page or the Learn tab, runs these status commands.
- For a Claude sign-in, sraww shows the sign-in link that Claude Code prints. When you paste the code the browser gives you, sraww passes that code to Claude Code and does not keep it. For a Codex sign-in, sraww shows the code and link that Codex provides.
- The tools run with only two environment variables from sraww, `PATH` and `HOME`. Any API key variable in your shell is not passed to them.

## What is sent to an AI provider, and when

Each AI action below sends only the content listed. Nothing is sent for an AI action unless you press the button or send the message.

| You do this                                     | What is sent to the provider                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press **Generate diagram** (New diagram mode)   | The text you typed in the assistant's message box                                                                                                                                                                      |
| Send a message (Edit this drawing mode)         | Your message; the last 12 messages of the chat; and a summary of the open drawing: each shape's identifier, kind and label, and each arrow's identifier, its label text, and the identifiers of the shapes it connects |
| Press **+** to explain the selected shapes      | The same as a chat message, but the summary covers only the selected shapes and arrows, plus the identifiers of the shapes those arrows connect and their label text                                                   |
| Press **Name with AI** on an architecture map   | For each folder: its path relative to the project root; up to 15 file base names (names only, not paths); and the other folders and npm packages it imports, with counts. File contents are never sent                 |
| Press **Review with AI** on an architecture map | Each folder's path and label, its file count and import edges with counts, and the computed findings (finding id, kind, severity, title and folder ids). Never file contents or file names.                            |

Architecture maps are built on your computer with no AI call. The map itself never leaves your machine.

**Building a lesson** (started from the Learn tab, which calls `POST /api/learn/lessons`) sends the topic you enter, and asks the tool to research it on the web. For this one call, Claude Code may search the web and read pages it chooses. Those searches and page reads are made by the tool, from its own process, under the provider's terms. For Claude, the call allows only web search and page reading as tools. Codex is not used for lessons. Its shell tool cannot be switched off for a web-enabled call, and a read-only sandbox does not stop it reading files on this computer. A lesson request made while Codex is the chosen tool is refused with a message, and nothing is sent. The tool's answer is saved as a lesson (see the lessons paragraph in [What is stored on your computer](#what-is-stored-on-your-computer)). sraww then checks each source address the lesson cites, as described in [Lesson sources](#lesson-sources).

The provider sees the content of each request. Anthropic and OpenAI handle it under their own terms, retention periods and privacy policies. Check those before you use the AI features with private material. The CLI tools may also have their own usage and telemetry settings. sraww does not change those settings. Their documentation explains them.

## Lesson sources

Lessons are the only feature where an AI tool reads web pages. After a lesson is written, sraww checks each source address the lesson cites. A check is one request from the sraww server process on your computer to that address. It asks for the page, follows at most three redirects, and uses only addresses that are https and do not carry a username or password. Every address that the host name resolves to must be on the public internet; if any is not, the source is dropped without a request. The request connects to the address that was checked, so the name cannot point somewhere else in between. Addresses on your own network, loopback addresses and link-local addresses are never contacted.

- The request contains only the address and two HTTP headers: a fixed `accept` header that asks for HTML or plain text, and the standard headers that the HTTP library adds. It does not contain your topic, drawings, files or lesson text.
- sraww reads only the status code and content type of the answer. It does not keep the page.
- A source that fails the check is dropped from the lesson. The reply to the request says how many were dropped. The saved lesson does not keep that count.

These requests are the only ones the sraww server makes to other websites. They do not pass through your browser, so the browser's network panel will not show them. The code is in `src/server/learn/sources.ts`.

## Code upload

On the **Architecture** tab, under **Code projects**, you can upload a project folder or a zip file so that its structure can be mapped. Before the upload you tick a notice that says the code stays on this computer. It explains that **Name with AI** sends each folder's path, up to 15 file names per folder, and the other folders and packages it imports with counts; **Review with AI** sends folder paths, folder labels, file and import counts, and computed findings. Neither sends file contents.

- GitHub import downloads the public repository you name from codeload.github.com. GitHub sees the request, as any website does. Only public repositories and branches are supported, with no token.
- **Where it is kept.** Each upload is a snapshot of the files that were kept, stored under `PROJECTS_DIR` with a small manifest. The manifest records the project name, when it was uploaded, when you accepted the notice, how many files were kept and their total size, and the list of files left out with the reason for each. The paths of left-out files are therefore stored as well. Their contents are not.
- **Skipped in the browser, not listed.** Before anything is sent, the browser leaves out the contents of package, build, cache and version-control folders (for example `node_modules`, `.git`, `dist`, `build`, `target`).
- **Oversized files are listed with their path and size.** For a folder upload, a file over 1 MB is skipped without reading its contents. For a zip upload, the browser reads the whole archive into memory, including compressed entry data, but does not decompress oversized files or include them in the re-packed upload. The zip includes only their paths and sizes in a small manifest entry. The server validates those entries and lists each with the reason “larger than 1 MB”.
- **Skipped folders in a zip are not unpacked or re-uploaded.** The browser reads the whole archive into memory, but does not decompress entries inside package, build, cache or version-control folders, and leaves them out of the re-packed upload. Folder uploads skip those folders before reading their files.
- **Left out by the server, and listed with a reason.** Credential, key and lock files (for example `.env`, `.npmrc`, `*.pem`, `package-lock.json`). Binary files such as images, fonts, archives and compiled code. Text files that match a known credential format: cloud access keys, private key blocks, and common API token prefixes. A password written in plain text in an ordinary file is not detected. Paths that try to leave the project are refused. The Architecture tab lists each of these with its reason.
- **Limits.** At most 5,000 files, 50 MB after unpacking, and a 60 MB zip. Only the files that are kept count toward these limits.
- **Where the checks happen.** The browser skips package, build, cache and version-control folders and oversized files before re-packing a zip. The server checks every file in the re-packed upload and validates the oversized-file manifest, so the rules hold even if the browser is changed.
- **What is sent to an AI tool.** The upload sends nothing to an AI tool. Mapping a project builds the map on your computer with no AI call. Pressing **Name with AI** sends the folder paths, up to 15 file names per folder, and import counts listed in the table above. Pressing **Review with AI** sends folder paths, folder labels, file and import counts, and computed findings. Neither action sends file contents; Review with AI does not send file names.
- **Deleting.** Click **Delete** beside a project on the Architecture tab. That removes its kept files and its manifest. Architecture maps made from the project are drawings in `DIAGRAMS_DIR`, and they keep their folder and file paths until you delete them.

If the upload does not do what this section says, that is a bug. Please report it.

## Third-party software inside the app

MathJax renders formulas locally on the server. The LaTeX source stays on this machine and is stored in the drawing.

The drawing editor is [Excalidraw](https://excalidraw.com), bundled into the app. Its source contains addresses for its own online services. What we have done and checked:

- **AI features in the editor are turned off.** Excalidraw's text-to-diagram and similar AI options are disabled in sraww.
- **The production build blocks outside requests from the browser.** The app sends a Content Security Policy (see `src/server/app.ts`) that allows the browser to contact only the app itself. A request to any other host is refused by the browser before it is sent.
- **Development is different.** The development server (`npm run dev`) sends no such policy, so Excalidraw's own requests are not blocked there. Use the production build (`npm run build`, then `npm start`) when you are concerned about outside requests.
- **Checked by hand:** in a production build, opening the main menu and the library caused no requests to other hosts.
- **Not yet verified:** the **Share** option and the **live collaboration** option in Excalidraw's own menu. sraww does not use them, but pressing them may contact Excalidraw's services. This is an open item, and we will either verify it or remove the options before a public release.

## How to check this yourself

- **Read the code.** sraww's own requests from the browser are made through `src/client/lib/api.ts`, which calls only the app's own `/api` routes. The server listens only on `127.0.0.1`, set in `src/server/index.ts`. The environment passed to the AI tools is set in `src/server/ai/services.ts` and `src/server/ai/runner.ts`.
- **Lesson sources are checked by the server.** Source checks from a lesson are made by the sraww server process, not the browser, so they are not in the browser's network panel. The code that makes them is in `src/server/learn/sources.ts`, and its tests are in `tests/server/learn-sources.test.ts`.
- **Watch the network.** Open the production build with your browser's developer tools on the Network tab. Every request should go to `127.0.0.1`. The AI tools make their own requests from their own processes, and those do not appear in the browser.
- **Run the test.** `npm run test:e2e` runs `e2e/privacy.spec.ts`. It fails if, during the flows it covers, the browser makes a request to a host other than this machine, or if the Content Security Policy blocks such a request. The covered flows are: the drawing list, a new drawing with the assistant in both of its modes, and the AI tools page. It does not cover the main menu, the library or the Share option.

## Changes to this policy

This file is versioned with the code. Every change appears in the repository history, with its date. The "Last updated" date at the top changes with each revision.

## Contact

Questions and reports go to the project's GitHub issues: https://github.com/Sumeet-basfore/sraww/issues. Please do not send personal details there.
