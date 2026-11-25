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
async function stubCourseApi(
  page: Page,
  listed: unknown[] = [],
  prebuiltTopicIds: string[] = [],
  modules = course.modules,
) {
  const savedCourse = { ...course, modules };
  let progress: { topicId: string | null } = { topicId: null };
  let builtLessons: Record<string, string> = Object.fromEntries(
    prebuiltTopicIds.map((topicId) => [topicId, `lesson-${topicId}`]),
  );
  const created: unknown[] = [];
  const progressSaved: unknown[] = [];
  const quizResultBodies: unknown[] = [];
  const quizGenerationCalls: number[] = [];
  let savedQuiz = {
    courseId: course.id,
    moduleId: 'module-1',
    sourceTopicIds: ['topic-1', 'topic-2'],
    createdAt: '2026-11-24T10:10:00.000Z',
    questions: [
      {
        id: 'question-1',
        prompt: 'What does a cache keep?',
        sampleAnswer: 'A cache keeps a copy of a response.',
        explanation: 'Reusing a copy avoids repeating work.',
      },
      {
        id: 'question-2',
        prompt: 'What does max-age control?',
        sampleAnswer: 'It controls how long a cached copy stays fresh.',
        explanation: 'Freshness determines whether a copy can be reused directly.',
      },
    ],
    attempts: 0,
    bestSelfRated: 0,
    lastSelfRated: 0,
    attemptIds: [] as string[],
  };

  await page.route('**/api/learn/courses', async (route) => {
    if (route.request().method() === 'POST') {
      created.push(route.request().postDataJSON());
      await route.fulfill(json({ course: savedCourse }, 201));
      return;
    }
    await route.fulfill(json({ courses: listed }));
  });
  await page.route(`**/api/learn/courses/${course.id}`, (route) =>
    route.fulfill(
      json({
        course: { ...savedCourse, progress },
        builtLessons,
        quizResults:
          savedQuiz.attempts > 0
            ? {
                'module-1': {
                  attempts: savedQuiz.attempts,
                  bestSelfRated: savedQuiz.bestSelfRated,
                  lastSelfRated: savedQuiz.lastSelfRated,
                  questionCount: savedQuiz.questions.length,
                },
              }
            : {},
      }),
    ),
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
    await route.fulfill(json({ course: { ...savedCourse, progress } }));
  });
  await page.route(`**/api/learn/courses/${course.id}/modules/module-1/quiz`, async (route) => {
    quizGenerationCalls.push(1);
    const { attemptIds, ...clientQuiz } = savedQuiz;
    void attemptIds;
    await route.fulfill(json({ quiz: clientQuiz }));
  });
  await page.route(
    `**/api/learn/courses/${course.id}/modules/module-1/quiz/results`,
    async (route) => {
      const result = route.request().postDataJSON() as {
        attemptId: string;
        selfRatedCount: number;
      };
      quizResultBodies.push(result);
      savedQuiz = {
        ...savedQuiz,
        attempts: savedQuiz.attempts + 1,
        bestSelfRated: Math.max(savedQuiz.bestSelfRated, result.selfRatedCount),
        lastSelfRated: result.selfRatedCount,
        attemptIds: [...savedQuiz.attemptIds, result.attemptId],
      };
      const { attemptIds, ...clientQuiz } = savedQuiz;
      void attemptIds;
      await route.fulfill(json({ quiz: clientQuiz }));
    },
  );
  await page.route(`**/api/learn/lessons/${lesson.id}`, (route) => route.fulfill(json({ lesson })));
  await page.route(`**/api/learn/lessons/${secondLesson.id}`, (route) =>
    route.fulfill(json({ lesson: secondLesson })),
  );

  return { created, progressSaved, quizResultBodies, quizGenerationCalls };
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

test('module practice saves only aggregate self-ratings and shows them again after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { quizGenerationCalls, quizResultBodies } = await stubCourseApi(page);

  await page.goto(`/#/course/${course.id}`);
  await expect(page.getByRole('button', { name: 'Practice module: Basics' })).toHaveCount(0);
  await topicRow(page, 'What a cache is').getByRole('button', { name: 'Open lesson' }).click();
  await page.getByRole('link', { name: '← Course' }).click();
  await expect(page.getByRole('button', { name: 'Practice module: Basics' })).toHaveCount(0);
  await topicRow(page, 'Freshness').getByRole('button', { name: 'Open lesson' }).click();
  await page.getByRole('link', { name: '← Course' }).click();

  const practice = page.getByRole('button', { name: 'Practice module: Basics' });
  await expect(practice).toBeVisible();
  await practice.click();
  await expect(page.getByRole('heading', { name: 'What does a cache keep?' })).toBeFocused();
  const typedAnswer = 'private typed answer that must not leave the page';
  await page.getByLabel('Your short answer').fill(typedAnswer);
  await page.getByRole('button', { name: 'Reveal sample answer' }).click();
  await expect(
    page.locator('.module-quiz-sample').getByText('A cache keeps a copy of a response.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByLabel('Your short answer').fill('another private answer');
  await page.getByRole('button', { name: 'Reveal sample answer' }).click();
  await page.getByRole('button', { name: 'Review again' }).click();
  await expect(page.getByRole('heading', { name: 'Self-rating saved' })).toBeVisible();
  expect(quizResultBodies).toHaveLength(1);
  expect(quizResultBodies[0]).toMatchObject({ selfRatedCount: 1 });
  expect(Object.keys(quizResultBodies[0] as object).sort()).toEqual([
    'attemptId',
    'selfRatedCount',
  ]);
  expect(JSON.stringify(quizResultBodies)).not.toContain(typedAnswer);
  expect(quizGenerationCalls).toHaveLength(1);

  await page.getByRole('button', { name: 'Return to course' }).click();
  await expect(page.getByText('Best self-rating: 1 of 2; last 1 of 2')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Best self-rating: 1 of 2; last 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Practice module: Basics' }).click();
  await expect(
    page.getByText('Your self-ratings: 1 attempt · best 1 of 2 · last 1 of 2'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Return to course' }).click();
  await topicRow(page, 'Freshness').getByRole('button', { name: 'Open lesson' }).click();
  await expect(page).toHaveURL(/#\/learn\/lesson-e2e-2$/);
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
  const tokenValue = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim(),
  );
  expect(tokenValue).not.toBe('');
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
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectControlsInside(page, width);
}

async function expectQuizFitsWidth(page: Page, width: number): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  for (const selector of ['.module-quiz', '.module-quiz textarea', '.module-quiz button']) {
    for (const element of await page.locator(selector).all()) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
}

const fullOutline = (
  [
    ['The HTTP cache', 'What a cache is', 'Freshness'],
    ['Where copies live', 'Browser caches', 'Shared caches'],
    ['Choosing a copy', 'Cache keys', 'The Vary header'],
    ['Lifetimes', 'Age and Date', 'Expires and max-age'],
    ['Checking a copy', 'Entity tags', 'Last-Modified'],
    ['Conditional requests', 'If-None-Match', 'Handling a 304 response'],
    ['Private responses', 'Private cache controls', 'Requests with credentials'],
    ['Stale responses', 'Revalidate in the background', 'Serve stale after an error'],
    ['Shared infrastructure', 'Reverse proxies', 'Content delivery networks'],
    ['Updating content', 'Versioned asset URLs', 'Purging cached responses'],
    ['Reading cache behavior', 'Inspect response headers', 'Compare warm and cold requests'],
    [
      'Plan a cache policy',
      'Choose defaults for static assets',
      'Review a policy for changing data',
    ],
  ] as const
).map(([title, ...topics], m) => ({
  id: `module-${m + 1}`,
  title,
  topics: topics.map((topic, t) => ({
    id: `topic-${m * 2 + t + 1}`,
    title: topic,
    summary: `Explore ${topic.toLowerCase()} in the context of HTTP caching.`,
  })),
}));

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`the full course opens and resumes at ${width}px in ${theme} theme`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await setTheme(page, theme);
      await stubCourseApi(page, [], [], fullOutline);

      await page.goto('/#/learn');
      await page.getByLabel('Topic').fill('HTTP caching');
      await page.getByRole('button', { name: 'Build course' }).click();
      await expect(page.getByRole('heading', { level: 1, name: course.title })).toBeVisible();
      await topicRow(page, 'Freshness').getByRole('button', { name: 'Open lesson' }).click();
      await page.getByRole('link', { name: '← Course' }).click();
      await page.reload();

      await expect(page.getByRole('heading', { level: 2 })).toHaveText(
        fullOutline.map((m) => m.title),
      );
      await expect(page.getByRole('heading', { level: 3 })).toHaveText(
        fullOutline.flatMap((m) => m.topics.map((t) => t.title)),
      );
      await expect(page.getByRole('button', { name: 'Open lesson' })).toHaveCount(24);
      await expect(topicRow(page, 'Freshness').getByText('Last opened')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await info.attach('full-outline', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page).toHaveURL(/#\/learn\/lesson-e2e-2$/);
    });

    test(`the module quiz fits ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await setTheme(page, theme);
      await stubCourseApi(page, [], ['topic-1', 'topic-2']);

      await page.goto(`/#/course/${course.id}`);
      await page.getByRole('button', { name: 'Practice module: Basics' }).click();
      await expect(page.getByRole('heading', { name: 'What does a cache keep?' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expectQuizFitsWidth(page, width);
    });
  }
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
  await expectFitsWidth(page, 1440);
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
