export const MOTIVATIONAL_MESSAGES = [
  'Small checks. Big impact.',
  'Let\'s keep the quality moving forward.',
  'Another day, another step toward excellence.',
  'Every detail matters.',
  'Keep the standards high.',
  'Precision today. Confidence tomorrow.',
  'Consistency creates excellence.',
  'Quality starts with what we do today.',
  'Stay sharp. Stay consistent.',
  'One team. One standard. Better results.',
  'Let\'s make quality visible today.',
  'Strong processes. Better outcomes.',
  'Your work keeps quality in motion.',
  'Excellence is built one action at a time.',
  'Keep improving what already works.',
  'Make today safer, smarter, better.',
  'Progress looks good on you.',
  'Let\'s keep Hematology running strong.',
  'Every result deserves precision.',
  'Good systems create great outcomes.',
  'Accuracy is a habit worth keeping.',
  'Quality is built in the details.',
  'Better processes start with one good decision.',
  'Keep moving the standard forward.',
  'Reliable work creates reliable results.',
  'Make every check count.',
  'Today\'s consistency becomes tomorrow\'s confidence.',
  'Excellence lives in the routine.',
  'Strong quality starts with strong habits.',
  'Precision is part of the process.',
  'Every improvement counts.',
  'Keep the workflow clean and the standards high.',
  'Quality is never accidental.',
  'Smart work. Safe results.',
  'Build better quality, one step at a time.',
  'Stay focused on what matters.',
  'Good quality starts before the result.',
  'Small improvements create lasting change.',
  'Make consistency your advantage.',
  'Better data. Better decisions.',
  'Keep quality simple, clear, and consistent.',
  'Every action shapes the standard.',
  'Accuracy first. Always.',
  'Keep progress visible.',
  'Better systems make better teams.',
  'Today is another chance to improve.',
  'Keep the process strong.',
  'Precision in every step.',
  'Quality grows through consistency.',
  'Let\'s make today count.',
] as const;

export type TimeGreetingPeriod = 'morning' | 'afternoon' | 'evening';

export interface DashboardGreeting {
  timeGreeting: string;
  firstName: string;
  accent: string;
  motivationalMessage: string;
  period: TimeGreetingPeriod;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Stable numeric seed from user id for daily message rotation. */
function hashUserSeed(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % 100_000;
  }
  return hash;
}

export function getUserFirstName(fullName?: string | null): string {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}

export function getTimeGreetingPeriod(date = new Date()): TimeGreetingPeriod {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getTimeGreeting(date = new Date()): string {
  switch (getTimeGreetingPeriod(date)) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    default:
      return 'Good evening';
  }
}

/** Sparingly used accent for the greeting line only. */
export function getGreetingAccent(date = new Date()): string {
  switch (getTimeGreetingPeriod(date)) {
    case 'morning':
      return '🌷';
    case 'afternoon':
      return '✨';
    default:
      return '🌙';
  }
}

/**
 * Deterministic daily motivational message — stable for the same user throughout the day,
 * varies by day of year and user id.
 */
export function getDailyMotivationalMessage(userId: string, date = new Date()): string {
  if (!userId) return MOTIVATIONAL_MESSAGES[0];
  const index = (getDayOfYear(date) + hashUserSeed(userId)) % MOTIVATIONAL_MESSAGES.length;
  return MOTIVATIONAL_MESSAGES[index]!;
}

export function buildDashboardGreeting(
  userId: string,
  fullName?: string | null,
  date = new Date(),
): DashboardGreeting {
  return {
    timeGreeting: getTimeGreeting(date),
    firstName: getUserFirstName(fullName),
    accent: getGreetingAccent(date),
    motivationalMessage: getDailyMotivationalMessage(userId, date),
    period: getTimeGreetingPeriod(date),
  };
}
