# 8. Testing and quality

## Commands

| Command | What it does | Notes |
| --- | --- | --- |
| `npm test` | Runs every unit and component test under `tests/` with Vitest (`vitest run`). | Config: `vitest.config.ts`, setup file `tests/setup.ts`, `restoreMocks` on. |
| `npx vitest run tests/client/<File>.test.tsx` | One file. | Use for fast loops. |
| `npm run typecheck` | `tsc --noEmit` over the whole project (strict). | Must pass before a commit. |
| `npm run lint` | ESLint 9 flat config (`eslint.config.js`). | Covers TS, TSX and tests. The stylesheets are not linted. |
| `npx prettier --check <files>` | Formatting check. | Config: `.prettierrc.json`. `npm run format` rewrites. |
| `npm run test:e2e` | Playwright, Chromium, all specs in `e2e/`. | Builds the client, then starts the server with `npm start` on port 4390. Takes minutes. |
| `E2E_DATA_DIR=<throwaway dir> npx playwright test e2e/learn.spec.ts` | One spec, with its data in a folder you choose. | The default data folder is `/tmp/sraww-e2e`. Set `E2E_DATA_DIR` to a scratch folder instead. |

`npm run build` runs the typecheck and then `vite build`. `npm start` serves the built client and the API.

## Unit and component tests (`tests/`)

- `tests/client/`: 47 test files of component and logic tests, run in jsdom (`// @vitest-environment jsdom` at the top of each DOM test). Uses Testing Library and `@testing-library/user-event`. Pages are tested through their real hash routes where it matters.
- `tests/server/`: 43 test files. Express routes are tested with `supertest`. Storage is tested against temporary folders. The AI wrappers are tested against small fake CLI scripts in `tests/fixtures/bin/` (for example `claude-ok`, `claude-error`, `claude-huge`, `claude-logged-out`), so no real model is called.
- `tests/fixtures/`: shared test data. `course-app.ts` builds a course app with a fixed outline and lesson. `fake-provider.ts` is an `AiProvider` double that records each call and can delay lesson answers (used by the concurrency tests). `sample-project/` is the folder that `ARCH_PROJECTS` points at in e2e.
- `tests/mocks/excalidraw.tsx`: a stand-in for the Excalidraw canvas, because jsdom cannot lay out a canvas. It records props and lets tests call the parts they need. It does not test real drawing behaviour.

## Browser tests (`e2e/`)

13 spec files. Each spec uses `e2e/fixtures.ts`, which marks the first-visit tour as seen, so the tour does not cover the page. `e2e/tour.spec.ts` checks the tour itself with a fresh browser.

- The AI endpoints are stubbed with Playwright routes, so no model is called.
- `e2e/learn.spec.ts` (8 tests): course creation and outline, opening a topic as a lesson, resume after reload, saved courses, phone without sideways scroll, the lesson layout at 390px in light and dark and at 1440px in light, the build-up controls, and a course with two topics resuming at the last one opened.
- Other specs cover the start page, the editor and its menus, drawing formulas, math templates, architecture maps and findings, projects, AI settings, privacy and project links.

## What the checks prove, and what they do not

- The unit tests prove behaviour of pure functions, schemas, routes and component states under the stand-in canvas.
- The e2e tests prove the flows work in Chromium with stubbed AI. They do not prove model quality, real CLI behaviour, or real Excalidraw drawing beyond what the spec asserts.
- Real CLI behaviour is checked only by the fake scripts and by hand. The lesson build time has not been measured.
- Visual look (colour, spacing, dark theme by eye) is not checked by any automated test except the layout and computed-colour assertions in the Learn spec.

## Known flaky tests

- `tests/client/Editor.test.tsx` > "shows a retry button when saving fails". It failed in full runs under machine load (load average about 14 to 15) and passed when run alone, six of six. Treat a single failure in a full run as load-related only after a solo rerun passes. Report it; do not hide it.
- Under heavy load, Vitest and Playwright timeouts can fail a test that passes alone. Rerun the one test before changing code.
- The Replay step of the build-up e2e test is timing-sensitive (see [07-open-items-and-roadmap.md](07-open-items-and-roadmap.md)).

## Review checklist used for each change

1. The change has tests at the layer where the behaviour lives (pure function, route, component, or e2e).
2. Typecheck, lint and Prettier pass on the changed files.
3. The affected unit tests pass; the full unit suite runs when the change touches shared code (`errors.ts`, `skeleton.ts`, schemas).
4. The e2e spec for the feature passes when the change touches a page or a flow.
5. Privacy text is checked against the code for any claim the change touches (see [09-privacy-and-security.md](09-privacy-and-security.md)).
6. The pull request states what was verified, with the exact result lines, and what was not verified.
