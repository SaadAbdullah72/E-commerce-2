import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { beginCooldown, useCooldown } from './useCooldown';

const KEY = 'shopyaro:cooldown:test';

describe('beginCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a cooldown that a hook mounted afterwards picks up', () => {
    beginCooldown(KEY, 60);
    act(() => vi.advanceTimersByTime(10_000));

    const { result } = renderHook(() => useCooldown(KEY, 60));
    expect(result.current).toMatchObject({ remaining: 50, isCoolingDown: true });
  });

  it('does not throw when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => beginCooldown(KEY, 60)).not.toThrow();
  });
});

describe('useCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useCooldown(KEY, 60));
    expect(result.current).toMatchObject({ remaining: 0, isCoolingDown: false });
  });

  it('counts down after start() and finishes at zero', () => {
    const { result } = renderHook(() => useCooldown(KEY, 60));

    act(() => result.current.start());
    expect(result.current).toMatchObject({ remaining: 60, isCoolingDown: true });

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(59);

    act(() => vi.advanceTimersByTime(59_000));
    expect(result.current).toMatchObject({ remaining: 0, isCoolingDown: false });
  });

  it('stores only an end timestamp, never anything else', () => {
    const { result } = renderHook(() => useCooldown(KEY, 60));
    act(() => result.current.start());

    const stored = window.sessionStorage.getItem(KEY);
    expect(Number(stored)).toBe(Date.now() + 60_000);
    expect(window.sessionStorage.length).toBe(1);
  });

  it('survives a refresh (remount) while the cooldown is still running', () => {
    const first = renderHook(() => useCooldown(KEY, 60));
    act(() => first.result.current.start());
    first.unmount();

    act(() => vi.advanceTimersByTime(20_000));

    const second = renderHook(() => useCooldown(KEY, 60));
    expect(second.result.current).toMatchObject({ remaining: 40, isCoolingDown: true });
  });

  it('ignores an expired stored value', () => {
    window.sessionStorage.setItem(KEY, String(Date.now() - 1000));
    const { result } = renderHook(() => useCooldown(KEY, 60));
    expect(result.current.remaining).toBe(0);
  });

  it('ignores a corrupt stored value', () => {
    window.sessionStorage.setItem(KEY, 'not-a-number');
    const { result } = renderHook(() => useCooldown(KEY, 60));
    expect(result.current.remaining).toBe(0);
  });

  it('keeps working when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() => useCooldown(KEY, 60));
    expect(result.current.remaining).toBe(0);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(60);
  });

  it('keeps separate cooldowns for separate keys', () => {
    const a = renderHook(() => useCooldown('key-a', 60));
    const b = renderHook(() => useCooldown('key-b', 60));
    act(() => a.result.current.start());
    expect(a.result.current.isCoolingDown).toBe(true);
    expect(b.result.current.isCoolingDown).toBe(false);
  });
});
