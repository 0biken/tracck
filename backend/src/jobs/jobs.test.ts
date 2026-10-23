import { describe, expect, it } from 'vitest';
import { JOB_STATUSES, backoffMs, canTransition, isSettled } from '@tracck/shared';

describe('job lifecycle', () => {
  it('allows the transitions in the architecture', () => {
    const allowed = [
      ['queued', 'running'],
      ['running', 'succeeded'],
      ['queued', 'cancelled'],
      ['running', 'retry_wait'],
      ['retry_wait', 'running'],
      ['running', 'failed'],
      ['running', 'cancelled'],
      ['running', 'needs_user_action'],
    ] as const;
    for (const [from, to] of allowed) expect(canTransition(from, to)).toBe(true);
  });

  it('never leaves succeeded or cancelled, and leaves failed only by retry', () => {
    for (const to of JOB_STATUSES) {
      expect(canTransition('succeeded', to)).toBe(false);
      expect(canTransition('cancelled', to)).toBe(false);
      expect(canTransition('failed', to)).toBe(to === 'queued');
    }
  });

  it('does not let a queued job skip running', () => {
    expect(canTransition('queued', 'succeeded')).toBe(false);
    expect(canTransition('queued', 'failed')).toBe(false);
  });

  it('treats only finished statuses as settled', () => {
    expect(JOB_STATUSES.filter(isSettled)).toEqual(['succeeded', 'failed', 'cancelled']);
  });});

describe('retry policy', () => {
  it('doubles the delay each attempt and stays inside the jitter band', () => {
    expect(backoffMs(1, { random: () => 0 })).toBe(2_500);
    expect(backoffMs(1, { random: () => 0.999999 })).toBeLessThanOrEqual(5_000);
    expect(backoffMs(2, { random: () => 0 })).toBe(5_000);
    expect(backoffMs(3, { random: () => 0 })).toBe(10_000);
  });

  it('caps the delay', () => {
    expect(backoffMs(30, { random: () => 0.999999 })).toBeLessThanOrEqual(5 * 60_000);
  });});
