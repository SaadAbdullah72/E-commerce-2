import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NeedsRefundBadge } from './OrderBadges';
import QueryState from './QueryState';
import StatCard from './StatCard';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('shows its text; the old indigo tone is purple', () => {
    render(<StatusBadge tone="indigo">Shipped</StatusBadge>);
    expect(screen.getByText('Shipped').className).toContain('text-purple-700');
  });

  it('uses AA-safe text colours on tinted backgrounds', () => {
    render(
      <>
        <StatusBadge tone="green">A</StatusBadge>
        <StatusBadge tone="amber">B</StatusBadge>
        <StatusBadge tone="red">C</StatusBadge>
      </>,
    );
    expect(screen.getByText('A').className).toContain('text-green-800');
    expect(screen.getByText('B').className).toContain('text-amber-800');
    expect(screen.getByText('C').className).toContain('text-red-800');
  });
});

describe('NeedsRefundBadge', () => {
  it('is red, has a warning icon and keeps its tooltip text', () => {
    render(<NeedsRefundBadge />);
    const badge = screen.getByText('Needs refund');
    expect(badge.className).toContain('text-red-800');
    expect(badge.querySelector('svg')).toBeInTheDocument();
    expect(badge).toHaveAttribute('title');
  });
});

describe('QueryState', () => {
  const base = { isPending: false, isError: false, refetch: () => {} };

  it('loading: skeleton rows with the old accessible label', () => {
    render(
      <QueryState query={{ ...base, isPending: true }} isEmpty={false} emptyText="" label="orders">
        data
      </QueryState>,
    );
    expect(screen.getByRole('status', { name: 'Loading orders' })).toBeInTheDocument();
  });

  it('error: friendly text and a Try again button that refetches', async () => {
    const refetch = vi.fn();
    render(
      <QueryState query={{ ...base, isError: true, refetch }} isEmpty={false} emptyText="" label="orders">
        data
      </QueryState>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the orders.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('empty: the message, and an action when given', () => {
    render(
      <QueryState
        query={base}
        isEmpty
        emptyText="No orders yet."
        label="orders"
        emptyAction={<button type="button">Clear filters</button>}
      >
        data
      </QueryState>,
    );
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.queryByText('data')).not.toBeInTheDocument();
  });

  it('data: shows the children', () => {
    render(
      <QueryState query={base} isEmpty={false} emptyText="" label="orders">
        data
      </QueryState>,
    );
    expect(screen.getByText('data')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  const ok = (data) => ({ data, isPending: false, isError: false, refetch: () => {} });

  it('shows a big tabular number with the label', () => {
    render(<StatCard label="Paid orders" query={ok(1234)} />);
    expect(screen.getByText('1,234').className).toContain('text-3xl');
    expect(screen.getByText('1,234').className).toContain('tabular-nums');
    expect(screen.getByText('Paid orders')).toBeInTheDocument();
  });

  it('warning and danger numbers use -700 shades', () => {
    render(
      <>
        <StatCard label="A" query={ok(2)} tone="warning" />
        <StatCard label="B" query={ok(3)} tone="danger" />
      </>,
    );
    expect(screen.getByText('2').className).toContain('text-amber-700');
    expect(screen.getByText('3').className).toContain('text-red-700');
  });

  it('loading and error states keep their roles; error retries', async () => {
    const refetch = vi.fn();
    const { rerender } = render(
      <StatCard label="X" query={{ isPending: true, isError: false, refetch }} />,
    );
    expect(screen.getByRole('status', { name: 'Loading X' })).toBeInTheDocument();
    rerender(<StatCard label="X" query={{ isPending: false, isError: true, refetch }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows an optional trend only when there is a number', () => {
    render(<StatCard label="Revenue" query={ok('$10')} trend={{ text: '12% from last week', direction: 'up' }} />);
    expect(screen.getByText('12% from last week').className).toContain('text-green-700');
  });
});
