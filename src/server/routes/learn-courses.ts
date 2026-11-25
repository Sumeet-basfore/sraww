import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  LEARN_ID_PATTERN,
  LEARN_LIMITS,
  type Course,
  type CourseModule,
  type CourseTopic,
  type Lesson,
  type ModuleQuiz,
  type ModuleQuizClient,
  type ModuleQuizResultSummary,
} from '../../shared/learn.ts';
import type { AiServices } from '../ai/services.ts';
import { buildLesson, toStoredLesson } from '../learn/lesson.ts';
import { generateOutline } from '../learn/outline.ts';
import { buildModuleQuiz } from '../learn/quiz.ts';
import { defaultSourceCheckDeps, type SourceCheckDeps } from '../learn/sources.ts';
import type { CourseStore } from '../storage/course-store.ts';
import type { CourseQuizStore } from '../storage/course-quiz-store.ts';
import { DiagramError } from '../storage/diagram-store.ts';
import type { LessonStore } from '../storage/lesson-store.ts';

const createBody = z.object({
  topic: z.string().trim().min(1).max(LEARN_LIMITS.maxTopic),
});

const progressBody = z.object({
  topicId: z.string().regex(LEARN_ID_PATTERN).nullable(),
});

const quizResultBody = z
  .object({
    attemptId: z.string().regex(LEARN_ID_PATTERN),
    selfRatedCount: z.number().int().min(0).max(LEARN_LIMITS.maxQuizQuestions),
  })
  .strict();

function topicsOf(course: Course): CourseTopic[] {
  return course.modules.flatMap((module) => module.topics);
}

function quizForClient(quiz: ModuleQuiz): ModuleQuizClient {
  const { attemptIds, ...clientQuiz } = quiz;
  void attemptIds;
  return clientQuiz;
}

interface TopicLesson {
  lesson: Lesson;
  skippedSources: number;
}

/**
 * Course routes. The outline is planned without web access. A topic's lesson is built, with the
 * same web research and source checks as a single lesson, the first time that topic is opened.
 */
export function createCourseRouter(
  courses: CourseStore,
  lessons: LessonStore,
  quizzes: CourseQuizStore,
  ai: AiServices,
  deps: SourceCheckDeps = defaultSourceCheckDeps,
  now: () => Date = () => new Date(),
): Router {
  const router = Router();
  const pendingBuilds = new Map<string, Promise<TopicLesson>>();
  const pendingQuizzes = new Map<string, Promise<ModuleQuiz | null>>();

  async function loadCourse(id: string): Promise<Course> {
    const course = await courses.read(id);
    if (!course) throw new DiagramError('NOT_FOUND', 'That course does not exist.');
    return course;
  }

  async function builtLessonsOf(course: Course): Promise<Record<string, string>> {
    const entries = await Promise.all(
      topicsOf(course).map(async (topic) => {
        const lesson = await lessons.findForTopic(course.id, topic.id);
        return lesson ? ([topic.id, lesson.id] as const) : null;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  }

  async function quizResultsOf(course: Course): Promise<Record<string, ModuleQuizResultSummary>> {
    const entries = await Promise.all(
      course.modules.map(async (module) => {
        const quiz = await quizzes.read(course.id, module.id);
        if (!quiz || quiz.attempts === 0 || !quizMatchesModule(quiz, module)) return null;
        return [
          module.id,
          {
            attempts: quiz.attempts,
            bestSelfRated: quiz.bestSelfRated,
            lastSelfRated: quiz.lastSelfRated,
            questionCount: quiz.questions.length,
          },
        ] as const;
      }),
    );
    return Object.fromEntries(entries.filter((entry) => entry !== null));
  }

  function moduleOf(course: Course, moduleId: string): CourseModule | undefined {
    return course.modules.find((module) => module.id === moduleId);
  }

  function quizMatchesModule(quiz: ModuleQuiz, module: CourseModule): boolean {
    return (
      quiz.sourceTopicIds.length === module.topics.length &&
      quiz.sourceTopicIds.every((topicId, index) => topicId === module.topics[index]?.id)
    );
  }

  async function getOrBuildQuiz(course: Course, module: CourseModule): Promise<ModuleQuiz | null> {
    const key = `${course.id}/${module.id}`;
    const existing = await quizzes.read(course.id, module.id);
    if (existing && quizMatchesModule(existing, module)) return existing;
    const alreadyBuilding = pendingQuizzes.get(key);
    if (alreadyBuilding) return alreadyBuilding;

    const sourceLessons = await Promise.all(
      module.topics.map((topic) => lessons.findForTopic(course.id, topic.id)),
    );
    const cached = await quizzes.read(course.id, module.id);
    if (cached && quizMatchesModule(cached, module)) return cached;
    const afterLessonRead = pendingQuizzes.get(key);
    if (afterLessonRead) return afterLessonRead;
    if (sourceLessons.some((lesson) => lesson === null)) {
      return null;
    }

    const completeLessons = sourceLessons.filter((lesson): lesson is Lesson => lesson !== null);
    const build = buildModuleQuiz(
      ai.providers[ai.currentDefault()],
      course,
      module,
      completeLessons.map((lesson) => ({
        topicId: lesson.topicId!,
        title: lesson.title,
        explanation: lesson.explanation,
        keyTerms: lesson.keyTerms,
      })),
      now(),
    ).then(async (quiz) => {
      await quizzes.save(quiz);
      return quiz;
    });
    pendingQuizzes.set(key, build);
    try {
      return await build;
    } finally {
      pendingQuizzes.delete(key);
    }
  }

  router.post('/courses', async (req, res) => {
    const body = createBody.parse(req.body);
    const providerId = ai.currentDefault();
    const outline = await generateOutline(ai.providers[providerId], body.topic);
    const course: Course = {
      ...outline,
      id: randomUUID(),
      prompt: body.topic,
      createdAt: now().toISOString(),
      progress: { topicId: null },
    };
    await courses.save(course);
    res.status(201).json({ course });
  });

  router.get('/courses', async (_req, res) => {
    res.json({ courses: await courses.list() });
  });

  router.get('/courses/:id', async (req, res) => {
    const course = await loadCourse(req.params.id);
    const [builtLessons, quizResults] = await Promise.all([
      builtLessonsOf(course),
      quizResultsOf(course),
    ]);
    res.json({ course, builtLessons, quizResults });
  });

  function buildTopicLesson(course: Course, topic: CourseTopic): Promise<TopicLesson> {
    return (async () => {
      const providerId = ai.currentDefault();
      const topicLabel = `${course.title}: ${topic.title}`;
      const built = await buildLesson(ai.providers[providerId], topicLabel, deps);
      const lesson: Lesson = {
        ...toStoredLesson(built, topicLabel, providerId, now()),
        courseId: course.id,
        topicId: topic.id,
      };
      await lessons.save(lesson);
      return { lesson, skippedSources: built.skippedSources };
    })();
  }

  router.post('/courses/:id/topics/:topicId/lesson', async (req, res) => {
    const course = await loadCourse(req.params.id);
    const topic = topicsOf(course).find((item) => item.id === req.params.topicId);
    if (!topic) throw new DiagramError('NOT_FOUND', 'That topic does not exist in this course.');

    // A second open of the same topic while its lesson is still being built waits for that build,
    // so two tabs share one lesson instead of paying for two web-research calls.
    const key = `${course.id}/${topic.id}`;
    const running = pendingBuilds.get(key);
    if (running) {
      res.json({ lesson: (await running).lesson });
      return;
    }
    const existing = await lessons.findForTopic(course.id, topic.id);
    if (existing) {
      res.json({ lesson: existing });
      return;
    }
    // Another request may have started the build while the lookup above was running.
    const started = pendingBuilds.get(key);
    if (started) {
      res.json({ lesson: (await started).lesson });
      return;
    }
    const build = buildTopicLesson(course, topic);
    pendingBuilds.set(key, build);
    try {
      const built = await build;
      res.status(201).json(built);
    } finally {
      pendingBuilds.delete(key);
    }
  });

  router.put('/courses/:id/progress', async (req, res) => {
    const body = progressBody.parse(req.body);
    const course = await loadCourse(req.params.id);
    if (body.topicId !== null && !topicsOf(course).some((topic) => topic.id === body.topicId)) {
      res.status(400).json({ error: 'That topic is not in this course.' });
      return;
    }
    const updated: Course = { ...course, progress: { topicId: body.topicId } };
    await courses.save(updated);
    res.json({ course: updated });
  });

  router.post('/courses/:id/modules/:moduleId/quiz', async (req, res) => {
    const course = await loadCourse(req.params.id);
    const module = moduleOf(course, req.params.moduleId);
    if (!module) throw new DiagramError('NOT_FOUND', 'That module does not exist in this course.');
    const quiz = await getOrBuildQuiz(course, module);
    if (!quiz) {
      res.status(409).json({ error: 'Build every lesson in this module before practicing.' });
      return;
    }
    res.json({ quiz: quizForClient(quiz) });
  });

  router.put('/courses/:id/modules/:moduleId/quiz/results', async (req, res) => {
    const { attemptId, selfRatedCount } = quizResultBody.parse(req.body);
    const course = await loadCourse(req.params.id);
    const module = moduleOf(course, req.params.moduleId);
    if (!module) throw new DiagramError('NOT_FOUND', 'That module does not exist in this course.');
    const quiz = await quizzes.read(course.id, module.id);
    if (!quiz || !quizMatchesModule(quiz, module)) {
      throw new DiagramError('NOT_FOUND', 'Practice this module before saving a result.');
    }
    if (selfRatedCount > quiz.questions.length) {
      res.status(400).json({ error: 'That self-rated count is higher than the question count.' });
      return;
    }
    const updated = await quizzes.recordResult(course.id, module.id, attemptId, selfRatedCount);
    if (!updated)
      throw new DiagramError('NOT_FOUND', 'Practice this module before saving a result.');
    res.json({ quiz: quizForClient(updated) });
  });

  return router;
}
