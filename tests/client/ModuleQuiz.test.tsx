// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleQuizClient } from '../../src/shared/learn.ts';
import { learnApi } from '../../src/client/lib/learn-api.ts';
import { ModuleQuizView } from '../../src/client/learn/ModuleQuiz.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const quiz: ModuleQuizClient = {
  courseId: 'course-1',
  moduleId: 'module-1',
  sourceTopicIds: ['topic-1'],
  createdAt: '2026-11-24T10:00:00.000Z',
  questions: [
    {
      id: 'question-1',
      prompt: 'What does a cache keep?',
      sampleAnswer: 'A cache keeps a copy of a response.',
      explanation: 'The copy can serve a later request.',
    },
    {
      id: 'question-2',
      prompt: 'What does max-age control?',
      sampleAnswer: 'It controls how long a copy stays fresh.',
      explanation: 'Freshness controls reuse.',
    },
  ],
  attempts: 0,
  bestSelfRated: 0,
  lastSelfRated: 0,
};

describe('ModuleQuizView', () => {
  it('keeps typed answers local, reveals sample answers, and saves only the aggregate count', async () => {
    const user = userEvent.setup();
    const savedQuiz = {
      ...quiz,
      attempts: 1,
      bestSelfRated: 1,
      lastSelfRated: 1,
    };
    const save = vi.spyOn(learnApi, 'saveQuizResult').mockResolvedValue({ quiz: savedQuiz });
    const onQuizUpdate = vi.fn();
    render(
      <ModuleQuizView
        quiz={quiz}
        moduleTitle="Basics"
        onQuizUpdate={onQuizUpdate}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'What does a cache keep?' })).toHaveFocus();
    const privateAnswer = 'a typed response that must remain on this page';
    await user.type(screen.getByLabelText('Your short answer'), privateAnswer);
    await user.click(screen.getByRole('button', { name: 'Reveal sample answer' }));
    expect(screen.getByRole('heading', { name: 'Sample answer' })).toHaveFocus();
    expect(screen.getByText('A cache keeps a copy of a response.')).toBeVisible();
    expect(screen.queryByLabelText('Your short answer')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.getByRole('heading', { name: 'What does max-age control?' })).toHaveFocus();
    await user.type(screen.getByLabelText('Your short answer'), 'another private response');
    await user.click(screen.getByRole('button', { name: 'Reveal sample answer' }));
    await user.click(screen.getByRole('button', { name: 'Review again' }));

    expect(await screen.findByRole('heading', { name: 'Self-rating saved' })).toHaveFocus();
    expect(save).toHaveBeenCalledOnce();
    const attemptId = save.mock.calls[0]?.[2];
    expect(attemptId).toMatch(/^[a-f0-9-]{36}$/);
    expect(save).toHaveBeenCalledWith('course-1', 'module-1', attemptId, 1);
    expect(JSON.stringify(save.mock.calls)).not.toContain(privateAnswer);
    expect(onQuizUpdate).toHaveBeenCalledWith(savedQuiz);
  });

  it('offers a retry after a failed aggregate save', async () => {
    const user = userEvent.setup();
    const savedQuiz = {
      ...quiz,
      attempts: 1,
      bestSelfRated: 0,
      lastSelfRated: 0,
    };
    const save = vi
      .spyOn(learnApi, 'saveQuizResult')
      .mockRejectedValueOnce(new Error('Temporary connection failure'))
      .mockResolvedValue({ quiz: savedQuiz });
    render(
      <ModuleQuizView
        quiz={quiz}
        moduleTitle="Basics"
        onQuizUpdate={() => {}}
        onClose={() => {}}
      />,
    );

    await user.type(screen.getByLabelText('Your short answer'), 'something to recall');
    await user.click(screen.getByRole('button', { name: 'Reveal sample answer' }));
    await user.click(screen.getByRole('button', { name: 'Review again' }));
    await user.type(await screen.findByLabelText('Your short answer'), 'freshness');
    await user.click(screen.getByRole('button', { name: 'Reveal sample answer' }));
    await user.click(screen.getByRole('button', { name: 'Review again' }));

    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary connection failure');
    await user.click(retry);

    expect(await screen.findByRole('heading', { name: 'Self-rating saved' })).toBeVisible();
    expect(save.mock.calls).toHaveLength(2);
    expect(save.mock.calls[0]).toMatchObject(['course-1', 'module-1', expect.any(String), 0]);
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  });
});
