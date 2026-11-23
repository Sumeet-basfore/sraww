# Privacy policy

Last updated: 2026-11-23

## The short version

sraww runs on your computer. It has no accounts, no analytics, no telemetry, and no servers of its own. Your drawings and settings stay in folders on your machine. Once the upload feature ships, your code will stay there too.

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

| Data                                             | Where it is kept                                               | Setting             | How to delete it                                                          |
| ------------------------------------------------ | -------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Drawings (`.excalidraw` files)                   | `DIAGRAMS_DIR`, default `./data/diagrams`                      | `DIAGRAMS_DIR`      | Delete the drawing in the app, or delete the folder                       |
| Architecture maps and their layouts              | `DIAGRAMS_DIR`                                                 | `DIAGRAMS_DIR`      | Delete the map in the app, or delete the folder                           |
| AI tool choices (which tool, model and effort)   | `AI_SETTINGS_FILE`, default `./data/ai-settings.json`          | `AI_SETTINGS_FILE`  | Delete the file. It holds no credentials                                  |
| Working folder for the AI tools                  | `AI_WORKDIR`, default `./data/ai-workdir`                      | `AI_WORKDIR`        | Delete the folder. The app removes its temporary files after each request |
| Excalidraw library (reusable shapes)             | `DIAGRAMS_DIR`, file `library.json`                            | `DIAGRAMS_DIR`      | Delete the file, or remove items in the editor's library panel            |
| Display preferences (theme, drawing style)       | Your browser's local storage, key `sraww.prefs`                | Settings in the app | Clear the site's data in your browser                                     |
| Editor drafts (library publishing, Mermaid text) | Your browser's local storage, written by the Excalidraw editor | None                | Clear the site's data in your browser. We have not confirmed these keys   |

The drawings, architecture maps, AI settings and working folder are plain files on your machine. sraww does not upload them anywhere.

The server writes its status messages to its console only. It does not write a log file.

## Sign-in and credentials

sraww never reads, stores or transmits a password, a sign-in token or an API key.

- **Claude Code** and **Codex** each sign you in through their own login flow. They keep the credentials in their own locations, under their own control.
- sraww runs the tools' status and sign-in commands. Checking your sign-in status, listing models and starting a sign-in run those tools' own commands. sraww reads the account details they report: the email address, the plan, the workspace or organisation name, and the sign-in method. It shows these to you and does not store them. Those commands may contact the provider over the network. We have not measured what they send, and they carry no drawings or code.
- For a Claude sign-in, sraww shows the sign-in link that Claude Code prints. When you paste the code the browser gives you, sraww passes that code to Claude Code and does not keep it. For a Codex sign-in, sraww shows the code and link that Codex provides.
- The tools run with only two environment variables from sraww, `PATH` and `HOME`. Any API key variable in your shell is not passed to them.

## What is sent to an AI provider, and when

Each AI action below sends only the content listed. Nothing is sent for an AI action unless you press the button or send the message.

| You do this                                   | What is sent to the provider                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Press **Generate**                            | The text you typed in the prompt box                                                                                                                                                                   |
| Send a **Chat** message                       | Your message; the last 12 messages of the chat; and a summary of the open drawing: each shape's identifier, kind and label, and each arrow's identifier and the identifiers of the shapes it connects  |
| Press **Explain selection**                   | The same as a chat message, but the summary covers only the selected shapes and arrows, plus the identifiers of the shapes those arrows connect                                                        |
| Press **Name with AI** on an architecture map | For each folder: its path relative to the project root; up to 15 file base names (names only, not paths); and the other folders and npm packages it imports, with counts. File contents are never sent |

Architecture maps are built on your computer with no AI call. The map itself never leaves your machine.

The provider sees the content of each request. Anthropic and OpenAI handle it under their own terms, retention periods and privacy policies. Check those before you use the AI features with private material. The CLI tools may also have their own usage and telemetry settings. sraww does not change those settings. Their documentation explains them.

## Code upload (planned, not yet released)

A feature that lets you upload a project folder or zip file is planned. It is not part of the app today. When it is released, this policy will be updated before the release. It commits to the following:

- Uploaded code is stored only in a folder on your machine, as a snapshot. The folder will be set in the configuration.
- Dependency folders, build output, lockfiles, binary files, and files that look like secrets (for example `.env` files, private keys and credential files) are excluded by default. The list of excluded files is shown to you before anything is sent.
- Code is sent to an AI provider only when you start an analysis, through the CLI you installed, and only after you accept a consent notice for that project.
- You can delete a project and all of its snapshots and cached results in one step.

If the released feature does not do what this section says, that is a bug. Please report it.

## Third-party software inside the app

The drawing editor is [Excalidraw](https://excalidraw.com), bundled into the app. Its source contains addresses for its own online services. What we have done and checked:

- **AI features in the editor are turned off.** Excalidraw's text-to-diagram and similar AI options are disabled in sraww.
- **The production build blocks outside requests from the browser.** The app sends a Content Security Policy (see `src/server/app.ts`) that allows the browser to contact only the app itself. A request to any other host is refused by the browser before it is sent.
- **Development is different.** The development server (`npm run dev`) sends no such policy, so Excalidraw's own requests are not blocked there. Use the production build (`npm run build`, then `npm start`) when you are concerned about outside requests.
- **Checked by hand:** in a production build, opening the main menu and the library caused no requests to other hosts.
- **Not yet verified:** the **Share** option and the **live collaboration** option in Excalidraw's own menu. sraww does not use them, but pressing them may contact Excalidraw's services. This is an open item, and we will either verify it or remove the options before a public release.

## How to check this yourself

- **Read the code.** sraww's own requests from the browser are made through `src/client/lib/api.ts`, which calls only the app's own `/api` routes. The server listens only on `127.0.0.1`, set in `src/server/index.ts`. The environment passed to the AI tools is set in `src/server/ai/services.ts` and `src/server/ai/runner.ts`.
- **Watch the network.** Open the production build with your browser's developer tools on the Network tab. Every request should go to `127.0.0.1`. The AI tools make their own requests from their own processes, and those do not appear in the browser.
- **Run the test.** `npm run test:e2e` runs `e2e/privacy.spec.ts`. It fails if, during the flows it covers, the browser makes a request to a host other than this machine, or if the Content Security Policy blocks such a request. The covered flows are: the drawing list, a new drawing with its Generate and Chat panels opened, and the AI tools page. It does not cover the main menu, the library or the Share option.

## Changes to this policy

This file is versioned with the code. Every change appears in the repository history, with its date. The "Last updated" date at the top changes with each revision.

## Contact

Questions and reports go to the project's GitHub issues: https://github.com/Sumeet-basfore/sraww/issues. Please do not send personal details there.
