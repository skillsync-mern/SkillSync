export const STATUS_LABEL = {
  applied: 'Applied',
  reviewing: 'In review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offer made',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

// Mirrors the server's pipeline rules; the server is still the authority.
export const TRANSITIONS = {
  applied: ['reviewing', 'shortlisted', 'rejected'],
  reviewing: ['shortlisted', 'interview', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['offered', 'rejected'],
  offered: ['hired', 'rejected'],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export const ACTION_LABEL = {
  reviewing: 'Start review',
  shortlisted: 'Shortlist',
  interview: 'Schedule interview',
  offered: 'Make offer',
  hired: 'Mark as hired',
  rejected: 'Reject',
};

export const roleHome = (role) => ({ jobseeker: '/dashboard', company: '/manage', recruiter: '/manage', admin: '/admin' }[role] || '/');

function money(n, currency) {
  if (currency === 'INR') return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  return `${currency} ${Math.round(n / 1000)}k`;
}

export function salaryRange(job) {
  const { salaryMin: lo, salaryMax: hi, currency = 'INR' } = job;
  if (!lo && !hi) return null;
  if (lo && hi) return `${money(lo, currency)} to ${money(hi, currency)} a year`;
  return `${money(lo || hi, currency)} a year`;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export function timeAgo(d) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const units = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week']];
  for (let i = units.length - 1; i >= 0; i--) {
    if (s >= units[i][0]) {
      const n = Math.floor(s / units[i][0]);
      return `${n} ${units[i][1]}${n > 1 ? 's' : ''} ago`;
    }
  }
}

export const splitSkills = (text) =>
  [...new Map(text.split(',').map((s) => s.trim()).filter(Boolean).map((s) => [s.toLowerCase(), s])).values()];
