import { describe, expect, it } from 'vitest';
import {
  MOTIVATIONAL_MESSAGES,
  buildDashboardGreeting,
  getDailyMotivationalMessage,
  getTimeGreeting,
  getUserFirstName,
} from '@/lib/dashboard/greeting';

describe('dashboard greeting', () => {
  const fixedDate = new Date('2026-09-02T09:00:00');

  it('returns time-based greeting', () => {
    expect(getTimeGreeting(fixedDate)).toBe('Good morning');
  });

  it('extracts first name from authenticated full name', () => {
    expect(getUserFirstName('Rawan Alfaifi')).toBe('Rawan');
  });

  it('keeps the same message stable for a user on the same day', () => {
    const a = getDailyMotivationalMessage('user-123', fixedDate);
    const b = getDailyMotivationalMessage('user-123', fixedDate);
    expect(a).toBe(b);
    expect(MOTIVATIONAL_MESSAGES).toContain(a);
  });

  it('can vary message by day while staying in pool', () => {
    const today = getDailyMotivationalMessage('user-123', fixedDate);
    const tomorrow = getDailyMotivationalMessage('user-123', new Date('2026-09-03T09:00:00'));
    expect(MOTIVATIONAL_MESSAGES).toContain(today);
    expect(MOTIVATIONAL_MESSAGES).toContain(tomorrow);
  });

  it('builds greeting with accent and motivational line', () => {
    const greeting = buildDashboardGreeting('user-123', 'Rawan Alfaifi', fixedDate);
    expect(greeting.timeGreeting).toBe('Good morning');
    expect(greeting.firstName).toBe('Rawan');
    expect(greeting.accent).toBeTruthy();
    expect(greeting.motivationalMessage.length).toBeGreaterThan(0);
  });
});
