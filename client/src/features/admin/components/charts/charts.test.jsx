import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ColumnChart from './ColumnChart';
import HBarChart from './HBarChart';
import Sparkline from './Sparkline';
import StackedBar from './StackedBar';

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/** n consecutive days from 2030-01-01 with the given values. */
const days = (values) =>
  values.map((count, index) => ({
    day: `2030-01-${String(index + 1).padStart(2, '0')}`,
    count,
  }));

describe('ColumnChart (bars)', () => {
  const values = [0, 100, 300, 0, 200, 100, 0, 400, 100, 0];

  it('draws one bar per day, with a title on each and a text summary on the chart', () => {
    render(<ColumnChart points={days(values)} unit="in revenue" formatValue={money} />);
    const chart = screen.getByRole('img', { name: /\$12\.00 in revenue between Jan 1 and Jan 10/ });
    expect(chart.querySelectorAll('rect')).toHaveLength(10);
    expect(screen.getByText('Jan 8: $4.00')).toBeInTheDocument();
    expect(chart.querySelector('desc')).toHaveTextContent(/Column chart of in revenue per day/);
  });

  it('highlights the best day in a stronger blue, and an empty day is a thin grey bar, not a gap', () => {
    render(<ColumnChart points={days(values)} unit="in revenue" formatValue={money} />);
    const rects = [...screen.getByRole('img').querySelectorAll('rect')];
    expect(rects[7].getAttribute('class')).toContain('fill-blue-600'); // Jan 8, $4.00
    expect(rects[2].getAttribute('class')).toContain('fill-blue-400');
    expect(rects[0].getAttribute('class')).toContain('fill-gray-200'); // Jan 1, $0
    expect(Number(rects[0].getAttribute('height'))).toBeGreaterThan(0);
    expect(Number(rects[0].getAttribute('height'))).toBeLessThan(2);
  });

  it('writes out the total, the daily average and the best day (nothing is hover-only)', () => {
    render(<ColumnChart points={days(values)} unit="in revenue" formatValue={money} />);
    expect(screen.getByText("$12.00")).toBeInTheDocument(); // total
    expect(screen.getByText("$1.20")).toBeInTheDocument(); // 1200 / 10 days
    expect(screen.getByText('Jan 8 ($4.00)')).toBeInTheDocument();
  });

  it('has a Y axis with tidy labels, gridlines and an average line', () => {
    const { container } = render(
      <ColumnChart
        points={days(values)}
        unit="in revenue"
        formatValue={money}
        formatTick={(cents) => `$${cents / 100}`}
      />,
    );
    for (const label of ['$0', '$1', '$2', '$3', '$4']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll('.border-gray-100').length).toBeGreaterThan(0);
    expect(container.querySelector('.border-dashed')).toBeInTheDocument();
    expect(screen.getByText(/^Avg /)).toBeInTheDocument();
  });

  it('labels the X axis every 4th day when there are many days, every day when there are few', () => {
    const { container, unmount } = render(
      <ColumnChart points={days(Array.from({ length: 30 }, (_, i) => (i % 3 ? 5 : 0)))} unit="sign-ups" integer />,
    );
    const axis = container.querySelector('.ml-14');
    expect(within(axis).getAllByText(/^Jan \d+$/)).toHaveLength(8); // 1, 5, 9 ... 29
    unmount();

    const few = render(<ColumnChart points={days([1, 2, 3, 4])} unit="sign-ups" integer />);
    expect(within(few.container.querySelector('.ml-14')).getAllByText(/^Jan \d+$/)).toHaveLength(4);
  });

  it('on a phone every other X label is hidden, so labels never run into each other', () => {
    const { container } = render(
      <ColumnChart points={days(Array.from({ length: 30 }, (_, i) => (i % 3 ? 5 : 0)))} unit="sign-ups" integer />,
    );
    const labels = [...container.querySelector('.ml-14').children];
    expect(labels).toHaveLength(8); // 1, 5, 9 ... 29: one every 4 days
    expect(labels.filter((label) => label.className.includes('max-sm:hidden'))).toHaveLength(4);
    expect(labels[0].className).not.toContain('max-sm:hidden');
    expect(labels[1].className).toContain('max-sm:hidden');
    expect(labels.every((label) => label.className.includes('whitespace-nowrap'))).toBe(true);
  });

  it('shows a tooltip with the date, the value and the extra line when a day is hovered', async () => {
    const points = days(values).map((point) => (point.count ? { ...point, extra: '2 orders' } : point));
    const { container } = render(<ColumnChart points={points} unit="in revenue" formatValue={money} />);
    const zones = container.querySelectorAll('.flex-1.h-full');
    expect(zones).toHaveLength(10);
    await userEvent.hover(zones[7]);
    expect(screen.getByText('2 orders')).toBeInTheDocument();
    const tip = screen.getByText('2 orders').parentElement;
    expect(within(tip).getByText('Jan 8')).toBeInTheDocument();
    expect(within(tip).getByText('$4.00')).toBeInTheDocument();
    await userEvent.unhover(zones[7]);
    expect(screen.queryByText('2 orders')).not.toBeInTheDocument();
  });

  it('shows a friendly empty state when there is nothing to draw (no flat chart)', () => {
    const { rerender } = render(<ColumnChart points={days([0, 0, 0])} unit="sign-ups" emptyText="No sign-ups yet." />);
    expect(screen.getByText('No sign-ups yet.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<ColumnChart points={[]} unit="sign-ups" emptyText="No sign-ups yet." />);
    expect(screen.getByText('No sign-ups yet.')).toBeInTheDocument();
  });
});

describe('ColumnChart (line mode)', () => {
  it('draws a line instead of bars when fewer than lineBelow days have data', () => {
    render(
      <ColumnChart
        points={days([0, 0, 500, 0, 0, 0, 200, 0, 0, 0])}
        unit="in revenue"
        formatValue={money}
        lineBelow={5}
      />,
    );
    const chart = screen.getByRole('img', { name: /\$7\.00 in revenue/ });
    expect(chart.querySelector('polyline')).toBeInTheDocument();
    expect(chart.querySelectorAll('rect')).toHaveLength(0);
    expect(chart.querySelector('desc')).toHaveTextContent(/Line chart/);
  });

  it('keeps bars when enough days have data', () => {
    render(
      <ColumnChart
        points={days([1, 2, 3, 4, 5, 0])}
        unit="in revenue"
        formatValue={money}
        lineBelow={5}
      />,
    );
    const chart = screen.getByRole('img');
    expect(chart.querySelectorAll('rect')).toHaveLength(6);
    expect(chart.querySelector('polyline')).not.toBeInTheDocument();
  });

  it('never switches to a line unless asked to', () => {
    render(<ColumnChart points={days([0, 0, 5])} unit="sign-ups" integer />);
    expect(screen.getByRole('img').querySelectorAll('rect')).toHaveLength(3);
  });
});

describe('StackedBar', () => {
  const segments = [
    { label: 'Paid', value: 12, tone: 'blue' },
    { label: 'Shipped', value: 5, tone: 'indigo' },
    { label: 'Delivered', value: 30, tone: 'green' },
    { label: 'Cancelled', value: 3, tone: 'gray' },
  ];

  it('spells out every number in the legend, in the order given, and a total line', () => {
    render(<StackedBar segments={segments} emptyText="none" totalLabel="orders" />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Paid: 12(24%)',
      'Shipped: 5(10%)',
      'Delivered: 30(60%)',
      'Cancelled: 3(6%)',
    ]);
    expect(screen.getByText(/^Total:/)).toHaveTextContent('Total: 50 orders');
  });

  it('writes the percentage inside segments wider than 15% only', () => {
    const { container } = render(<StackedBar segments={segments} emptyText="none" />);
    const bar = container.querySelector('.rounded-full.bg-gray-100');
    expect(bar.textContent).toBe('24%60%'); // Paid and Delivered; Shipped 10% and Cancelled 6% are too thin
  });

  it('shows a tooltip with count and share when a segment is hovered', async () => {
    const { container } = render(<StackedBar segments={segments} emptyText="none" />);
    const parts = container.querySelector('.rounded-full.bg-gray-100').children;
    await userEvent.hover(parts[1]);
    expect(screen.getByText('5 (10%)')).toBeInTheDocument();
    await userEvent.unhover(parts[1]);
    expect(screen.queryByText('5 (10%)')).not.toBeInTheDocument();
  });

  it('has AA-safe label colours (white on dark, dark on amber and grey)', () => {
    const { container } = render(
      <StackedBar
        emptyText="none"
        segments={[
          { label: 'A', value: 1, tone: 'amber' },
          { label: 'B', value: 1, tone: 'green' },
          { label: 'C', value: 1, tone: 'gray' },
        ]}
      />,
    );
    const parts = container.querySelector('.rounded-full.bg-gray-100').children;
    expect(parts[0].className).toContain('text-amber-950');
    expect(parts[1].className).toContain('bg-green-700');
    expect(parts[2].className).toContain('text-gray-900');
  });

  it('says so when every part is 0', () => {
    render(<StackedBar segments={[{ label: 'A', value: 0, tone: 'blue' }]} emptyText="No orders yet." />);
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
  });
});

describe('HBarChart', () => {
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it('shows name, bold number and extra, with bars sized against the biggest', () => {
    const { container } = wrap(
      <HBarChart
        emptyText="none"
        rows={[
          { id: 'a', label: 'Earbuds', value: 10, extra: 'units · $100.00' },
          { id: 'b', label: 'Cable', value: 5 },
        ]}
      />,
    );
    expect(screen.getByText('Earbuds')).toBeInTheDocument();
    expect(screen.getByText('units · $100.00')).toBeInTheDocument();
    const bars = container.querySelectorAll('[style*="width"]');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
  });

  it('turns the name into a link when the row has an href', () => {
    wrap(<HBarChart emptyText="none" rows={[{ id: 'a', label: 'Earbuds', value: 3, href: '/admin/products/p1' }]} />);
    expect(screen.getByRole('link', { name: 'Earbuds' })).toHaveAttribute('href', '/admin/products/p1');
  });

  it('clamps a long name to two lines', () => {
    wrap(<HBarChart emptyText="none" rows={[{ id: 'a', label: 'A very long product name', value: 1 }]} />);
    expect(screen.getByText('A very long product name').className).toContain('line-clamp-2');
  });

  it('shows the empty message with an icon', () => {
    wrap(<HBarChart emptyText="No sales yet." rows={[]} />);
    expect(screen.getByText('No sales yet.')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('has a name, and the exact value of each day on hover (title)', () => {
    render(<Sparkline points={days([100, 300, 200])} formatValue={money} label="Last 7 days" />);
    const spark = screen.getByRole('img', { name: 'Last 7 days, 3 days' });
    expect(spark.querySelectorAll('polyline')).toHaveLength(1);
    expect(screen.getByText('Jan 2: $3.00')).toBeInTheDocument();
  });

  it('draws nothing for fewer than 2 days', () => {
    const { container } = render(<Sparkline points={days([100])} formatValue={money} label="x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('copes with all zeros (a flat line, no crash)', () => {
    render(<Sparkline points={days([0, 0, 0])} formatValue={money} label="Quiet" />);
    expect(screen.getByRole('img', { name: 'Quiet, 3 days' })).toBeInTheDocument();
  });
});
