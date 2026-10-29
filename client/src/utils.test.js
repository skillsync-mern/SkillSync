import { salaryRange, splitSkills, roleHome, TRANSITIONS, timeAgo } from './utils';

describe('utils', () => {
  test('formats INR salaries in lakhs and other currencies in thousands', () => {
    expect(salaryRange({ salaryMin: 1200000, salaryMax: 2000000, currency: 'INR' })).toBe('₹12L to ₹20L a year');
    expect(salaryRange({ salaryMin: 85000, salaryMax: 120000, currency: 'USD' })).toBe('USD 85k to USD 120k a year');
    expect(salaryRange({})).toBeNull();
  });

  test('splitSkills trims and removes case-insensitive duplicates', () => {
    expect(splitSkills(' React, node.js ,react,, MongoDB ')).toEqual(['react', 'node.js', 'MongoDB']);
  });

  test('each role lands on its own home screen', () => {
    expect(roleHome('jobseeker')).toBe('/dashboard');
    expect(roleHome('recruiter')).toBe('/manage');
    expect(roleHome('admin')).toBe('/admin');
  });

  test('finished applications have no further transitions', () => {
    expect(TRANSITIONS.hired).toEqual([]);
    expect(TRANSITIONS.rejected).toEqual([]);
    expect(TRANSITIONS.applied).not.toContain('hired');
  });

  test('timeAgo gives plain-language ages', () => {
    expect(timeAgo(new Date())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 3 * 3600 * 1000))).toBe('3 hours ago');
    expect(timeAgo(new Date(Date.now() - 86400 * 1000))).toBe('1 day ago');
  });
});
