import { describe, expect, it } from 'vitest';

import { compactMoney, niceScale, sevenDayTrend, shortDay } from './chartScale';

describe('niceScale', () => {
  it('rounds the top up to a tidy number with even ticks from 0', () => {
    expect(niceScale(87)).toEqual({ top: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(100)).toEqual({ top: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(12000)).toEqual({ top: 15000, ticks: [0, 5000, 10000, 15000] });
  });

  it('counts use whole steps only', () => {
    expect(niceScale(4, { integer: true })).toEqual({ top: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(2, { integer: true })).toEqual({ top: 2, ticks: [0, 1, 2] });
    expect(niceScale(1, { integer: true })).toEqual({ top: 1, ticks: [0, 1] });
  });

  it('never divides by zero: all zeros still give a usable scale', () => {
    const scale = niceScale(0, { integer: true });
    expect(scale.top).toBeGreaterThan(0);
    expect(scale.ticks[0]).toBe(0);
  });

  it('the top is always at least the biggest value', () => {
    for (const max of [1, 3, 7, 19, 250, 4999, 123456]) {
      expect(niceScale(max).top).toBeGreaterThanOrEqual(max);
    }
  });
});

describe('compactMoney', () => {
  it('writes short labels from minor units', () => {
    expect(compactMoney(0, 'USD')).toBe('$0');
    expect(compactMoney(25000, 'USD')).toBe('$250');
    expect(compactMoney(100000, 'USD')).toBe('$1K');
    expect(compactMoney(250000, 'USD')).toBe('$2.5K');
  });

  it('is empty for a bad value', () => {
    expect(compactMoney(undefined, 'USD')).toBe('');
  });
});

describe('shortDay', () => {
  it('formats a UTC day', () => {
    expect(shortDay('2030-01-14')).toBe('Jan 14');
  });
});

describe('sevenDayTrend', () => {
  // 7 days "before", 7 days "current", and today (unfinished, always ignored)
  const days = (previous, current, today = 0) => [
    ...Array.from({ length: 7 }, (_, index) => ({ day: `p${index}`, count: previous })),
    ...Array.from({ length: 7 }, (_, index) => ({ day: `c${index}`, count: current })),
    { day: 'today', count: today },
  ];

  it('goes up, down or stays flat, in whole percent', () => {
    expect(sevenDayTrend(days(100, 150))).toMatchObject({
      direction: 'up',
      text: 'Up 50% vs the 7 days before',
    });
    expect(sevenDayTrend(days(200, 150))).toMatchObject({
      direction: 'down',
      text: 'Down 25% vs the 7 days before',
    });
    expect(sevenDayTrend(days(100, 100))).toMatchObject({
      direction: 'flat',
      text: 'No change vs the 7 days before',
    });
  });

  it('today is never counted: a part-day does not make steady sales look like a drop', () => {
    expect(sevenDayTrend(days(100, 100, 0)).direction).toBe('flat');
    expect(sevenDayTrend(days(100, 100, 99999)).direction).toBe('flat');
  });

  it('says that it uses full UTC days', () => {
    expect(sevenDayTrend(days(100, 150)).note).toBe('Full UTC days, today not counted');
  });

  it('only the 14 full days before today count', () => {
    const older = Array.from({ length: 16 }, (_, index) => ({ day: `o${index}`, count: 9999 }));
    expect(sevenDayTrend([...older, ...days(100, 150)]).text).toBe('Up 50% vs the 7 days before');
  });

  it('sales after a week with none say so, without dividing by zero', () => {
    expect(sevenDayTrend(days(0, 50))).toMatchObject({
      direction: 'up',
      text: 'Up from no sales in the 7 days before',
    });
  });

  it('is null when there is nothing to compare', () => {
    expect(sevenDayTrend(days(0, 0))).toBeNull();
    expect(sevenDayTrend(days(1, 1).slice(1))).toBeNull(); // 14 points: not enough
    expect(sevenDayTrend([])).toBeNull();
  });
});
