import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';

const projectRoot = process.env.PROJECT_ROOT
  ? path.resolve(process.env.PROJECT_ROOT)
  : process.cwd();
const shape = process.env.SHAPE;
if (shape !== 'baseline' && shape !== 'candidate') {
  throw new Error('Set SHAPE to baseline or candidate.');
}

const runs = Number(process.env.RUNS ?? 5);
if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('RUNS must be a positive integer.');
const moduleCount = shape === 'baseline' ? 8 : 12;
const topicCount = shape === 'baseline' ? 12 : 24;
const fixtureUrl = (name: string) =>
  pathToFileURL(path.join(projectRoot, 'tests/fixtures', name)).href;
const sourceUrl = (name: string) =>
  pathToFileURL(path.join(projectRoot, 'src/server/storage', name)).href;
const [
  { courseApp, OUTLINE, LESSON },
  { fakeProvider },
  { createCourseStore },
  { createLessonStore },
] = await Promise.all([
  import(fixtureUrl('course-app.ts')),
  import(fixtureUrl('fake-provider.ts')),
  import(sourceUrl('course-store.ts')),
  import(sourceUrl('lesson-store.ts')),
]);

const probeDataRoot = process.env.PROBE_DATA_DIR?.trim();
const dataDir = probeDataRoot
  ? path.join(path.resolve(probeDataRoot), 'sraww-course-capacity')
  : await mkdtemp(path.join(os.tmpdir(), 'sraww-capacity-'));
let ownsDataDir = !probeDataRoot;
try {
  if (probeDataRoot) {
    await mkdir(path.resolve(probeDataRoot), { recursive: true });
    await mkdir(dataDir);
    ownsDataDir = true;
  }

  const topics = Array.from({ length: topicCount }, (_, index) => ({
    id: `topic-${index + 1}`,
    title: `Topic ${index + 1}`,
    summary: `A short saved summary for topic ${index + 1}.`,
  }));
  const modules = Array.from({ length: moduleCount }, (_, index) => ({
    id: `module-${index + 1}`,
    title: `Module ${index + 1}`,
    topics: [] as typeof topics,
  }));
  topics.forEach((topic, index) => modules[index % moduleCount]?.topics.push(topic));
  const course = {
    id: 'perf-course',
    title: 'Local course capacity probe',
    prompt: 'Local course capacity probe',
    createdAt: '2026-11-25T00:00:00.000Z',
    modules,
    progress: { topicId: topics[0]?.id ?? null },
  };
  await createCourseStore(dataDir).save(course);
  const lessonStore = createLessonStore(dataDir);
  for (const topic of topics) {
    await lessonStore.save({
      id: `lesson-${topic.id}`,
      title: topic.title,
      explanation: `${topic.summary} This lesson is saved for the course load probe.`,
      keyTerms: ['course', 'topic'],
      sources: [
        {
          title: 'Probe source',
          url: 'https://example.com/probe',
          points: ['Probe source point.'],
        },
      ],
      diagram: {
        nodes: [{ id: 'topic', label: 'Topic' }],
        edges: [],
        direction: 'right',
        title: 'Topic',
      },
      topic: `${course.title}: ${topic.title}`,
      createdAt: course.createdAt,
      provider: 'claude',
      courseId: course.id,
      topicId: topic.id,
    });
  }

  const app = courseApp(dataDir, fakeProvider({ outline: OUTLINE, lesson: LESSON }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${address.port}/api/learn/courses/perf-course`;
  const warmups = 5;
  const requestsPerRun = 30;
  const samples: number[][] = [];
  const expectedLessons = topics.map(({ id }) => [id, `lesson-${id}`] as const);
  let successes = 0;
  let errors = 0;
  const failedStatuses = new Map<number, number>();

  async function getCourse(): Promise<{ elapsedMs: number; ok: boolean }> {
    const started = performance.now();
    const response = await fetch(endpoint);
    const body = (await response.json()) as {
      course?: { modules?: unknown[] };
      builtLessons?: Record<string, string>;
    };
    const elapsedMs = performance.now() - started;
    const ok =
      response.status === 200 &&
      body.course?.modules?.length === moduleCount &&
      Object.keys(body.builtLessons ?? {}).length === topicCount &&
      expectedLessons.every(([id, lessonId]) => body.builtLessons?.[id] === lessonId);
    if (ok) successes += 1;
    else {
      errors += 1;
      failedStatuses.set(response.status, (failedStatuses.get(response.status) ?? 0) + 1);
    }
    return { elapsedMs, ok };
  }

  for (let index = 0; index < warmups; index += 1) {
    const result = await getCourse();
    if (!result.ok) throw new Error(`Warmup failed with an invalid course response.`);
  }
  for (let run = 0; run < runs; run += 1) {
    const durations: number[] = [];
    for (let index = 0; index < requestsPerRun; index += 1) {
      const result = await getCourse();
      durations.push(result.elapsedMs);
    }
    samples.push(durations);
  }

  const p95s = samples.map(p95).sort((a, b) => a - b);
  const midpoint = (p95s.length - 1) / 2;
  const medianP95Ms = (p95s[Math.floor(midpoint)]! + p95s[Math.ceil(midpoint)]!) / 2;
  const output = {
    shape,
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    loadAverage1m: round(os.loadavg()[0] ?? 0),
    cpuCount: os.cpus().length,
    dataDir,
    moduleCount,
    topicCount,
    warmups,
    requestsPerRun,
    runs,
    p95Ms: p95s.map(round),
    medianP95Ms: round(medianP95Ms),
    p95RangeMs: [round(p95s[0] ?? 0), round(p95s.at(-1) ?? 0)],
    successes,
    errors,
    failedStatuses: Object.fromEntries(failedStatuses),
    verifiedBuiltLessons: topicCount,
  };
  console.log(JSON.stringify(output));
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (errors > 0) process.exitCode = 1;
} finally {
  if (ownsDataDir) await rm(dataDir, { recursive: true, force: true });
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
