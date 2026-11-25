import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const lesson = {
  id: 'lesson-e2e-1',
  topic: 'HTTP caching: What a cache is',
  title: 'HTTP caching: keep a copy, check it is fresh',
  explanation:
    'A cache keeps a copy of a response.\n\nCache-Control says how long the copy stays fresh.',
  keyTerms: ['Cache-Control'],
  sources: [
    {
      title: 'HTTP caching guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
      points: ['Freshness is set by max-age.'],
    },
  ],
  diagram: {
    direction: 'right',
    nodes: [
      { id: 'browser', label: 'Browser', shape: 'rounded' },
      { id: 'cache', label: 'Cache', shape: 'rounded' },
    ],
    edges: [{ from: 'browser', to: 'cache', label: 'asks first' }],
  },
  createdAt: '2026-11-24T10:00:00.000Z',
  provider: 'claude',
  courseId: 'course-e2e-1',
  topicId: 'topic-1',
};

const secondLesson = {
  ...lesson,
  id: 'lesson-e2e-2',
  title: 'Freshness: a copy stays fresh for max-age',
  explanation: 'max-age tells a cache how long a copy stays fresh.',
  topicId: 'topic-2',
};

const course = {
  id: 'course-e2e-1',
  title: 'HTTP caching',
  prompt: 'How HTTP caching works',
  createdAt: '2026-11-24T10:00:00.000Z',
  modules: [
    {
      id: 'module-1',
      title: 'Basics',
      topics: [
        { id: 'topic-1', title: 'What a cache is', summary: 'A cache keeps a copy of a response.' },
        { id: 'topic-2', title: 'Freshness', summary: 'A copy stays fresh for a set time.' },
      ],
    },
    {
      id: 'module-2',
      title: 'Checking copies',
      topics: [
        {
          id: 'topic-3',
          title: 'Validators',
          summary: 'A validator asks whether a copy is still good.',
        },
      ],
    },
  ],
  progress: { topicId: null },
};

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function topicRow(page: Page, title: string) {
  return page.locator('li', { has: page.getByRole('heading', { level: 3, name: title }) });
}

/**
 * Stubs the course endpoints as one small server. The course keeps its progress and the lessons
 * built for it, so reopening the course shows what the learner did before.
 */
async function stubCourseApi(page: Page, listed: unknown[] = []) {
  let progress: { topicId: string | null } = { topicId: null };
  let builtLessons: Record<string, string> = {};
  const created: unknown[] = [];
  const progressSaved: unknown[] = [];

  await page.route('**/api/learn/courses', async (route) => {
    if (route.request().method() === 'POST') {
      created.push(route.request().postDataJSON());
      await route.fulfill(json({ course }, 201));
      return;
    }
    await route.fulfill(json({ courses: listed }));
  });
  await page.route(`**/api/learn/courses/${course.id}`, (route) =>
    route.fulfill(json({ course: { ...course, progress }, builtLessons })),
  );
  await page.route(`**/api/learn/courses/${course.id}/topics/topic-1/lesson`, async (route) => {
    builtLessons = { ...builtLessons, 'topic-1': lesson.id };
    await route.fulfill(json({ lesson, skippedSources: 0 }, 201));
  });
  await page.route(`**/api/learn/courses/${course.id}/topics/topic-2/lesson`, async (route) => {
    builtLessons = { ...builtLessons, 'topic-2': secondLesson.id };
    await route.fulfill(json({ lesson: secondLesson, skippedSources: 0 }, 201));
  });
  await page.route(`**/api/learn/courses/${course.id}/progress`, async (route) => {
    progress = route.request().postDataJSON() as { topicId: string | null };
    progressSaved.push(progress);
    await route.fulfill(json({ course: { ...course, progress } }));
  });
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));
  await page.route(`**/api/learn/lessons/${secondLesson.id}`, (route) =>
    route.fulfill(json({ lesson: secondLesson })),
  );

  return { created, progressSaved };
}

test('a topic becomes a course outline, opens as a lesson, and the course resumes at it', async ({
  page,
}) => {
  const { created, progressSaved } = await stubCourseApi(page);

  await page.goto('/#/learn');
  await page.getByLabel('Topic').fill('  How HTTP caching works  ');
  await page.getByRole('button', { name: 'Build course' }).click();

  await expect(page).toHaveURL(/#\/course\/course-e2e-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'HTTP caching' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Basics' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Checking copies' })).toBeVisible();
  await expect(topicRow(page, 'What a cache is').getByText('Not built yet')).toBeVisible();

  await topicRow(page, 'What a cache is').getByRole('button', { name: 'Open lesson' }).click();
  await expect(page).toHaveURL(/#\/learn\/lesson-e2e-1$/);
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
  await expect(page.getByText('Cache-Control says how long')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Course' })).toHaveAttribute(
    'href',
    '#/course/course-e2e-1',
  );

  await page.getByRole('link', { name: '← Course' }).click();
  await expect(page).toHaveURL(/#\/course\/course-e2e-1$/);
  await expect(topicRow(page, 'What a cache is').getByText('Ready')).toBeVisible();
  await expect(topicRow(page, 'What a cache is').getByText('Last opened')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

  expect(created).toEqual([{ topic: 'How HTTP caching works' }]);
  expect(progressSaved).toEqual([{ topicId: 'topic-1' }]);
});

test('a saved course on the Learn tab opens its course page', async ({ page }) => {
  await stubCourseApi(page, [
    { id: course.id, title: course.title, createdAt: course.createdAt, topicCount: 3 },
  ]);

  await page.goto('/#/learn');
  await page.getByRole('link', { name: 'HTTP caching' }).click();

  await expect(page).toHaveURL(/#\/course\/course-e2e-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'HTTP caching' })).toBeVisible();
});

test('the course page fits a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubCourseApi(page);

  await page.goto(`/#/course/${course.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'HTTP caching' })).toBeVisible();
  await expect(topicRow(page, 'Validators')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const noteColour = await page
    .locator('.course-topic-note')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  const softInk = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--ink-soft)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
  expect(noteColour).toBe(softInk);
});

/** Sets the theme the app reads from saved preferences, before the page loads. */
async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((value: string) => {
    try {
      window.localStorage.setItem(
        'sraww.prefs',
        JSON.stringify({ theme: value, drawingStyle: 'hand' }),
      );
    } catch {
      // Storage is blocked in this context; the page then uses the light theme.
    }
  }, theme);
}

/** Every build-up control sits inside the screen. */
async function expectControlsInside(page: Page, width: number): Promise<void> {
  await expect(page.locator('.build-controls button').first()).toBeVisible();
  for (const button of await page.locator('.build-controls button').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
}

/** The page does not scroll sideways, and every build-up control sits inside the screen. */
async function expectFitsWidth(page: Page, width: number): Promise<void> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  await expectControlsInside(page, width);
}

for (const theme of ['light', 'dark'] as const) {
  test(`the lesson page stacks the drawing above the explanation at 390px in ${theme} theme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    await page.route(`**/api/learn/lessons/${lesson.id}`, (route) =>
      route.fulfill(json({ lesson })),
    );

    await page.goto(`/#/learn/${lesson.id}`);
    await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
    await expect(page.locator('.excalidraw')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    const canvas = await page.locator('.lesson-canvas').boundingBox();
    const explanation = await page.getByText('A cache keeps a copy of a response.').boundingBox();
    expect(canvas).not.toBeNull();
    expect(explanation).not.toBeNull();
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(explanation!.y);
    await expectFitsWidth(page, 390);
  });
}

test('the lesson page sits the drawing beside the explanation at 1440px in light theme', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, 'light');
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));

  await page.goto(`/#/learn/${lesson.id}`);
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
  await expect(page.locator('.excalidraw')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const canvas = await page.locator('.lesson-canvas').boundingBox();
  const explanation = await page.getByText('A cache keeps a copy of a response.').boundingBox();
  expect(canvas).not.toBeNull();
  expect(explanation).not.toBeNull();
  expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(explanation!.x);
  await expectControlsInside(page, 1440);
});

test('the build-up plays in steps, pauses, resumes, and its controls work at any point', async ({
  page,
}) => {
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));

  await page.goto(`/#/learn/${lesson.id}`);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Step 0 of 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 1 of 2', { exact: true })).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect(page.getByText('Step 1 of 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText('Step 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.getByText('Step 0 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();

  await page.getByRole('button', { name: 'Skip to end', exact: true }).click();
  await expect(page.getByText('Step 2 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});

test('a course with two topics resumes at the topic last opened, after a reload', async ({
  page,
}) => {
  const { progressSaved } = await stubCourseApi(page);

  await page.goto(`/#/course/${course.id}`);
  await topicRow(page, 'What a cache is').getByRole('button', { name: 'Open lesson' }).click();
  await expect(page.getByRole('heading', { level: 1, name: lesson.title })).toBeVisible();
  await page.getByRole('button', { name: 'Skip to end', exact: true }).click();
  await expect(page.getByText('Step 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Course' }).click();
  await expect(topicRow(page, 'What a cache is').getByText('Ready')).toBeVisible();

  await topicRow(page, 'Freshness').getByRole('button', { name: 'Open lesson' }).click();
  await expect(page.getByRole('heading', { level: 1, name: secondLesson.title })).toBeVisible();
  await page.getByRole('link', { name: '← Course' }).click();
  expect(progressSaved).toEqual([{ topicId: 'topic-1' }, { topicId: 'topic-2' }]);

  await page.reload();
  await expect(page).toHaveURL(/#\/course\/course-e2e-1$/);
  await expect(topicRow(page, 'Freshness').getByText('Last opened')).toBeVisible();
  await expect(topicRow(page, 'What a cache is').getByText('Last opened')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/#\/learn\/lesson-e2e-2$/);
  await expect(page.getByRole('heading', { level: 1, name: secondLesson.title })).toBeVisible();
});
