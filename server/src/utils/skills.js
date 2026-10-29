// Trim, drop empties, dedupe case-insensitively (keeps first spelling).
function normalizeSkills(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const s = String(raw).trim();
    const k = s.toLowerCase();
    if (s && !seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

// How well a candidate's skills cover a job's required skills.
function matchSkills(jobSkills = [], userSkills = []) {
  const have = new Set(userSkills.map((s) => s.toLowerCase()));
  const matched = jobSkills.filter((s) => have.has(s.toLowerCase()));
  const missing = jobSkills.filter((s) => !have.has(s.toLowerCase()));
  const score = jobSkills.length ? Math.round((matched.length / jobSkills.length) * 100) : 0;
  return { score, matched, missing };
}

module.exports = { normalizeSkills, matchSkills };
