import { useEffect, useRef, useState } from 'react';
import type { ModuleQuizClient } from '../../shared/learn.ts';
import { errorMessage } from '../lib/errors.ts';
import { learnApi } from '../lib/learn-api.ts';

interface ModuleQuizProps {
  quiz: ModuleQuizClient;
  moduleTitle: string;
  onQuizUpdate: (quiz: ModuleQuizClient) => void;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'failed' | 'saved';

/** Short-answer practice. Draft answers live only in this component and never enter an API call. */
export function ModuleQuizView({
  quiz: initialQuiz,
  moduleTitle,
  onQuizUpdate,
  onClose,
}: ModuleQuizProps) {
  const [quiz, setQuiz] = useState(initialQuiz);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [ratedCount, setRatedCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingAttemptId, setPendingAttemptId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sampleHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const question = quiz.questions[questionIndex];

  useEffect(() => {
    if (completed) resultHeadingRef.current?.focus();
    else if (revealed) sampleHeadingRef.current?.focus();
    else headingRef.current?.focus();
  }, [completed, questionIndex, revealed]);

  function revealSample(): void {
    if (!draft.trim()) return;
    setDraft('');
    setRevealed(true);
  }

  async function saveResult(selfRatedCount: number, attemptId: string): Promise<void> {
    setSaveState('saving');
    setSaveError('');
    try {
      const { quiz: updated } = await learnApi.saveQuizResult(
        quiz.courseId,
        quiz.moduleId,
        attemptId,
        selfRatedCount,
      );
      setQuiz(updated);
      setPendingCount(null);
      setPendingAttemptId(null);
      setSaveState('saved');
      setCompleted(true);
      onQuizUpdate(updated);
    } catch (err) {
      setSaveState('failed');
      setSaveError(errorMessage(err));
    }
  }

  function rateQuestion(gotIt: boolean): void {
    const nextCount = ratedCount + (gotIt ? 1 : 0);
    if (questionIndex === quiz.questions.length - 1) {
      const attemptId = globalThis.crypto.randomUUID();
      setPendingCount(nextCount);
      setPendingAttemptId(attemptId);
      void saveResult(nextCount, attemptId);
      return;
    }
    setRatedCount(nextCount);
    setQuestionIndex((index) => index + 1);
    setDraft('');
    setRevealed(false);
  }

  function retrySave(): void {
    if (pendingCount !== null && pendingAttemptId !== null) {
      void saveResult(pendingCount, pendingAttemptId);
    }
  }

  function restart(): void {
    setQuestionIndex(0);
    setDraft('');
    setRevealed(false);
    setRatedCount(0);
    setCompleted(false);
    setPendingCount(null);
    setPendingAttemptId(null);
    setSaveState('idle');
    setSaveError('');
  }

  if (!question) return null;

  return (
    <section className="module-quiz" aria-labelledby="module-quiz-title">
      <div className="module-quiz-heading-row">
        <div>
          <p className="course-section-title">Optional practice</p>
          <h2 id="module-quiz-title">{moduleTitle}</h2>
        </div>
        <button type="button" className="link-button" onClick={onClose}>
          Return to course
        </button>
      </div>

      {quiz.attempts > 0 && (
        <p className="module-quiz-history" aria-label="Saved self-rated results">
          Your self-ratings: {quiz.attempts} {quiz.attempts === 1 ? 'attempt' : 'attempts'} · best{' '}
          {quiz.bestSelfRated} of {quiz.questions.length} · last {quiz.lastSelfRated} of{' '}
          {quiz.questions.length}
        </p>
      )}

      {completed ? (
        <div className="module-quiz-complete" role="status" aria-live="polite">
          <h3 ref={resultHeadingRef} tabIndex={-1}>
            Self-rating saved
          </h3>
          <p>
            You marked {pendingCount ?? quiz.lastSelfRated} of {quiz.questions.length} questions as
            got it. This is your own assessment, not a grade.
          </p>
          <button type="button" className="button primary" onClick={restart}>
            Practice again
          </button>
        </div>
      ) : (
        <>
          <p className="module-quiz-progress" aria-live="polite">
            Question {questionIndex + 1} of {quiz.questions.length}
          </p>
          <h3 ref={headingRef} tabIndex={-1} className="module-quiz-question">
            {question.prompt}
          </h3>
          {!revealed ? (
            <div className="module-quiz-answer">
              <label htmlFor="module-quiz-draft">Your short answer</label>
              <textarea
                id="module-quiz-draft"
                value={draft}
                maxLength={2000}
                rows={4}
                onChange={(event) => setDraft(event.target.value)}
              />
              <p className="module-quiz-privacy">
                Your answer stays on this screen. It is removed when you reveal the sample answer or
                leave practice, and is never sent or saved.
              </p>
              <button
                type="button"
                className="button primary"
                disabled={!draft.trim()}
                onClick={revealSample}
              >
                Reveal sample answer
              </button>
            </div>
          ) : (
            <div className="module-quiz-sample">
              <h4 ref={sampleHeadingRef} tabIndex={-1}>
                Sample answer
              </h4>
              <p>{question.sampleAnswer}</p>
              <p className="module-quiz-explanation">{question.explanation}</p>
              {saveState === 'saving' ? (
                <p role="status">Saving your self-rating…</p>
              ) : (
                <div className="module-quiz-ratings">
                  <button
                    type="button"
                    className="button primary"
                    disabled={saveState === 'failed'}
                    onClick={() => rateQuestion(true)}
                  >
                    Got it
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={saveState === 'failed'}
                    onClick={() => rateQuestion(false)}
                  >
                    Review again
                  </button>
                </div>
              )}
              {saveState === 'failed' && (
                <div className="module-quiz-save-error">
                  <p className="banner error" role="alert">
                    {saveError}
                  </p>
                  <button type="button" className="button" onClick={retrySave}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
