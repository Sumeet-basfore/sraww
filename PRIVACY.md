# Privacy policy

Last updated: 2026-11-23

## The short version

sraww runs on your computer. It has no accounts, no analytics, no telemetry, and no servers of its own. Your drawings, settings and (once the upload feature ships) your code stay in folders on your machine.

When you use an AI feature, the text involved is sent by the Claude Code or Codex command-line tool you installed to that tool's provider (Anthropic or OpenAI), using your own account. Their terms and privacy policies apply to that traffic. sraww cannot see it, and it cannot change it.

The maintainer does not receive any data from your installation.

You do not have to trust this document. Every claim below can be checked in the code, in the browser's network panel, or with the automated test named in [How to check this yourself](#how-to-check-this-yourself).

## What sraww does not do

- It does not ask you to create an account or give an email address.
- It does not collect analytics, crash reports or usage statistics.
- It does not set cookies or load tracking pixels.
- It does not load fonts, scripts or images from other websites. The app ships its own fonts and serves them itself.
- It does not hold API keys, passwords or tokens. See [Sign-in and credentials](#sign-in-and-credentials).
- It does not send anything to a server operated by the maintainer. There is no such server.

## What is stored on your computer

| Data                                           | Where it is kept                                      | Setting             | How to delete it                                 |
| ---------------------------------------------- | ----------------------------------------------------- | ------------------- | ------------------------------------------------ |
| Drawings (`.excalidraw` files)                 | `DIAGRAMS_DIR`, default `./data/diagrams`             | `DIAGRAMS_DIR`      | Delete the file in the app, or delete the folder |
| Architecture maps and their layouts            | `DIAGRAMS_DIR`                                        | `DIAGRAMS_DIR`      | Delete the map in the app, or delete the folder  |
| AI tool choices (which tool, model and effort) | `AI_SETTINGS_FILE`, default `./data/ai-settings.json` | `AI_SETTINGS_FILE`  | Delete the file. It holds no credentials         |
| Working folder for the AI tools                | `AI_WORKDIR`, default `./data/ai-workdir`             | `AI_WORKDIR`        | Delete the folder. It is kept empty on purpose   |
| Display preferences (theme, drawing style)     | Your browser's local storage, key `sraww.prefs`       | Settings in the app | Clear the site's data in your browser            |

Everything above is plain files or browser storage on your machine. Nothing in this table is uploaded by sraww.

The server writes its status messages to its console only. It does not write a log file.

## Sign-in and credentials

sraww never reads, stores or transmits a password, a sign-in token or an API key.

- **Claude Code** and **Codex** each sign you in through their own login flow. They keep the credentials in their own locations, under their own control.
- sraww runs the tools' status commands to learn whether you are signed in, and reads the account details those commands report: the email address, the plan, the workspace or organisation name, and the sign-in method. It shows these to you and stores none of them.
- For a Claude sign-in, sraww shows the sign-in link that Claude Code prints. When you paste the code the browser gives you, sraww passes that code to Claude Code and does not keep it. For a Codex sign-in, sraww shows the code and link that Codex provides.
- The tools run with only two environment variables from sraww, `PATH` and `HOME`. Any API key variable in your shell is not passed to them.

## What is sent to an AI provider, and when

Nothing is sent to an AI provider unless you do one of the following. Each action sends only the content listed.

| You do this                                             | What is sent to the provider                                                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Press **Generate**                                      | The text you typed in the prompt box                                                                                                                                                                |
| Send a **Chat** message, or press **Explain selection** | Your message; the last 12 messages of the chat; a summary of the open drawing: the shapes' labels and identifiers, and the arrows between them. For **Explain selection**, only the selected shapes |
| Press **Name with AI** on an architecture map           | Folder names; up to 15 file names per folder, names only; and counts of the links between folders. File contents are never sent                                                                     |

Architecture maps are built on your computer with no AI call. The map itself never leaves your machine.

The provider sees the content of each request. Anthropic and OpenAI handle it under their own terms, retention periods and privacy policies. Check those before you use the AI features with private material. The CLI tools may also have their own usage and telemetry settings. sraww does not change those settings. Their documentation explains them.

## Code upload (planned, not yet released)

A feature that lets you upload a project folder or zip file is planned. It is not part of the app today. When it is released, this policy will be updated before the release. It commits to the following:

- Uploaded code is stored only under `PROJECTS_DIR` on your machine, as a snapshot.
- Dependency folders, build output, lockfiles, binary files, and files that look like secrets (for example `.env` files, private keys and credential files) are excluded by default. The list of excluded files is shown to you before anything is sent.
- Code is sent to an AI provider only when you start an analysis, through the CLI you installed, and only after you accept a consent notice for that project.
- You can delete a project and all of its snapshots and cached results in one step.

If the released feature does not do what this section says, that is a bug. Please report it.

## Third-party software inside the app

The drawing editor is [Excalidraw](https://excalidraw.com), bundled into the app. Excalidraw's source contains addresses for its own online services, such as sharing and live collaboration. What we have checked:

- Opening the drawing list, a drawing, the AI tools page, the main menu, the library and the Generate and Chat panels causes no requests to other websites. The drawing list, a drawing and the AI tools page are covered by `e2e/privacy.spec.ts`. The other items were checked by hand.
- Earlier builds asked a third-party font host for Excalidraw's fonts. That was a bug, and it is fixed. The app now serves those fonts itself.
- We have not yet verified the **Share** option and the **live collaboration** option in Excalidraw's own menu. sraww does not use them, but if you press them, they may contact Excalidraw's services. This is an open item, and we will either verify it or remove the options before a public release.

## How to check this yourself

- **Read the code.** Outgoing requests from the browser are made through `src/client/lib/api.ts`, which only calls the app's own `/api` routes. The server listens only on `127.0.0.1`, set in `src/server/index.ts`. The environment passed to the AI tools is set in `src/server/ai/services.ts` and `src/server/ai/runner.ts`.
- **Watch the network.** Open the app with your browser's developer tools on the Network tab. Every request should go to `127.0.0.1`. Note that the AI tools make their own requests from their own processes, and those do not appear in the browser.
- **Run the test.** `npm run test:e2e` runs `e2e/privacy.spec.ts`. It fails if the browser contacts any host other than this machine.

## Changes to this policy

This file is versioned with the code. Every change appears in the repository history, with its date. The "Last updated" date at the top changes with each revision.

## Contact

Questions and reports go to the project's GitHub issues: https://github.com/Sumeet-basfore/sraww/issues. Please do not send personal details there.
