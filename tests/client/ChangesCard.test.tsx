// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChangesCard } from '../../src/client/arch/ChangesCard.tsx';

afterEach(cleanup);

describe('ChangesCard', () => {
  it('keeps the first-scan wording and summarizes changes from a baseline', () => {
    const { rerender } = render(
      <ChangesCard
        diff={{
          hasBaseline: false,
          addedNodes: [],
          removedNodes: [],
          addedEdges: [],
          removedEdges: [],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Changes since last scan' })).toBeInTheDocument();
    expect(screen.getByText('First scan. Nothing to compare with yet.')).toBeInTheDocument();

    rerender(
      <ChangesCard
        diff={{
          hasBaseline: true,
          addedNodes: ['src/new'],
          removedNodes: [],
          addedEdges: ['src>src/new'],
          removedEdges: [],
        }}
      />,
    );

    expect(
      screen.getByText('1 new / 0 removed folders · 1 new / 0 removed links'),
    ).toBeInTheDocument();
    expect(screen.getByText('src/new')).toBeInTheDocument();
    expect(screen.getByText('src>src/new')).toBeInTheDocument();
  });
});
