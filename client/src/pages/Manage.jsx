import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { useFetch, Loader, Notice, Empty, StatusBadge, SkillChips, MatchMeter, Pagination, Field, PageHead } from '../ui';
import { STATUS_LABEL, TRANSITIONS, ACTION_LABEL, fmtDate, fmtDateTime, timeAgo, splitSkills } from '../utils';

const PIPELINE = ['applied', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected', 'withdrawn'];

/* ------------------------------ overview ------------------------------ */
export function Overview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get('/manage/stats'), []);
  const [msg, setMsg] = useState('');

  const resubmit = async () => {
    try {
      await api.post('/manage/company/resubmit');
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <PageHead title={data?.company?.name || 'Hiring overview'}>
        <Link className="btn" to="/manage/jobs?new=1">Post a job</Link>
      </PageHead>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        {data && (
          <div className="stack">
            {data.company.status === 'pending' && <Notice kind="warn">Your company is waiting for administrator approval. Jobs you post stay hidden from candidates until then.</Notice>}
            {data.company.status === 'rejected' && (
              <Notice kind="error">
                Your company was not approved{data.company.statusReason ? `: ${data.company.statusReason}` : '.'}{' '}
                {user.role === 'company' ? <><Link to="/manage/company">Update your profile</Link>, then <button className="btn small" onClick={resubmit}>Resubmit for review</button></> : 'Ask the company owner to update the profile.'}
              </Notice>
            )}
            <div className="grid tiles">
              <div className="tile"><b>{data.jobs.open || 0}</b><span>Open jobs</span></div>
              <div className="tile"><b>{data.applications.total}</b><span>Applications</span></div>
              <div className="tile"><b>{data.applications.byStatus.interview || 0}</b><span>In interview</span></div>
              <div className="tile"><b>{data.applications.byStatus.hired || 0}</b><span>Hired</span></div>
            </div>
            <div className="grid two">
              <section className="card">
                <h2>Pipeline</h2>
                <div className="bars">
                  {PIPELINE.map((s) => {
                    const n = data.applications.byStatus[s] || 0;
                    const max = Math.max(1, ...Object.values(data.applications.byStatus));
                    return (
                      <div className="bar" key={s}><span>{STATUS_LABEL[s]}</span><i style={{ width: `${(n / max) * 100}%` }} /><span>{n}</span></div>
                    );
                  })}
                </div>
              </section>
              <section className="card">
                <h2>Newest applications</h2>
                {data.recentApplications.length ? (
                  <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {data.recentApplications.map((a) => (
                      <li key={a._id}><strong>{a.applicant.name}</strong> for {a.job.title} <span className="muted small">{timeAgo(a.createdAt)}</span> <StatusBadge status={a.status} /></li>
                    ))}
                  </ul>
                ) : <p className="muted">No applications yet.</p>}
                <p><Link to="/manage/applicants">Review all applicants</Link></p>
              </section>
            </div>
          </div>
        )}
      </Loader>
    </>
  );
}

/* --------------------------------- jobs --------------------------------- */
function JobForm({ job, onSaved, onCancel }) {
  const [f, setF] = useState({
    title: job?.title || '',
    description: job?.description || '',
    location: job?.location || '',
    type: job?.type || 'full-time',
    workMode: job?.workMode || 'onsite',
    skills: (job?.skills || []).join(', '),
    experienceMin: job?.experienceMin ?? 0,
    salaryMin: job?.salaryMin ?? '',
    salaryMax: job?.salaryMax ?? '',
    deadline: job?.deadline ? job.deadline.slice(0, 10) : '',
    status: job?.status || 'open',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const num = (v) => (v === '' ? null : Number(v));
    const body = { ...f, skills: splitSkills(f.skills), experienceMin: Number(f.experienceMin) || 0, salaryMin: num(f.salaryMin), salaryMax: num(f.salaryMax), deadline: f.deadline || null };
    try {
      if (job) await api.patch(`/manage/jobs/${job._id}`, body);
      else await api.post('/manage/jobs', body);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{job ? 'Edit job' : 'Post a job'}</h2>
      <Notice kind="error">{error}</Notice>
      <div className="form-grid">
        <div className="full"><Field label="Job title"><input required value={f.title} onChange={set('title')} /></Field></div>
        <div className="full"><Field label="Description" hint="At least 20 characters"><textarea required value={f.description} onChange={set('description')} /></Field></div>
        <Field label="Location"><input value={f.location} onChange={set('location')} placeholder="e.g. Hyderabad or Remote" /></Field>
        <Field label="Job type"><select value={f.type} onChange={set('type')}>{['full-time', 'part-time', 'contract', 'internship'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Work mode"><select value={f.workMode} onChange={set('workMode')}>{['onsite', 'hybrid', 'remote'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Minimum experience (years)"><input type="number" min="0" value={f.experienceMin} onChange={set('experienceMin')} /></Field>
        <div className="full"><Field label="Required skills" hint="Separate with commas. Candidates are matched against these."><input value={f.skills} onChange={set('skills')} placeholder="React, Node.js, MongoDB" /></Field></div>
        <Field label="Yearly salary from (INR)"><input type="number" min="0" value={f.salaryMin} onChange={set('salaryMin')} /></Field>
        <Field label="Yearly salary up to (INR)"><input type="number" min="0" value={f.salaryMax} onChange={set('salaryMax')} /></Field>
        <Field label="Apply by"><input type="date" value={f.deadline} onChange={set('deadline')} /></Field>
        <Field label="Status"><select value={f.status} onChange={set('status')}><option value="open">Open (visible to candidates)</option><option value="draft">Draft (hidden)</option><option value="closed">Closed</option></select></Field>
      </div>
      <div className="row"><button className="btn" disabled={busy}>{busy ? 'Saving…' : job ? 'Save changes' : 'Publish job'}</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function ManageJobs() {
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(params.get('new') ? {} : null);
  const [msg, setMsg] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get('/manage/jobs'), []);

  const act = async (fn) => {
    setMsg('');
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  if (editing)
    return <JobForm job={editing._id ? editing : null} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;

  return (
    <>
      <PageHead title="Jobs"><button className="btn" onClick={() => setEditing({})}>Post a job</button></PageHead>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        {data?.items.length ? (
          <div className="card flat table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Status</th><th>Applicants</th><th>Posted by</th><th>Apply by</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((j) => (
                  <tr key={j._id}>
                    <td><Link to={`/jobs/${j._id}`}>{j.title}</Link><div className="muted small">{j.location}</div></td>
                    <td><StatusBadge status={j.status} /></td>
                    <td><Link to={`/manage/applicants?job=${j._id}`}>{j.applicantCount}</Link></td>
                    <td>{j.postedBy?.name}</td>
                    <td>{fmtDate(j.deadline) || 'None'}</td>
                    <td>
                      <div className="row">
                        {j.status !== 'removed' && <button className="btn ghost small" onClick={() => setEditing(j)}>Edit</button>}
                        {j.status === 'open' && <button className="btn ghost small" onClick={() => act(() => api.patch(`/manage/jobs/${j._id}`, { status: 'closed' }))}>Close</button>}
                        {['closed', 'draft'].includes(j.status) && <button className="btn ghost small" onClick={() => act(() => api.patch(`/manage/jobs/${j._id}`, { status: 'open' }))}>{j.status === 'draft' ? 'Publish' : 'Reopen'}</button>}
                        <button className="btn ghost small" onClick={() => window.confirm(`Delete "${j.title}"?`) && act(() => api.del(`/manage/jobs/${j._id}`))}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No jobs posted yet">Post your first job to start receiving applications.</Empty>}
      </Loader>
    </>
  );
}

/* ----------------------------- applicants ----------------------------- */
function ApplicantPanel({ id, onChanged }) {
  const { data, loading, error, reload } = useFetch(() => api.get(`/manage/applications/${id}`), [id]);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ note: '', interviewAt: '' });
  const [noteText, setNoteText] = useState('');
  const [msg, setMsg] = useState('');

  const changed = () => { reload(); onChanged(); };
  const confirm = async () => {
    setMsg('');
    try {
      const body = { status: action };
      if (form.note) body.note = form.note;
      if (action === 'interview') body.interviewAt = form.interviewAt ? new Date(form.interviewAt).toISOString() : undefined;
      await api.patch(`/manage/applications/${id}/status`, body);
      setAction(null);
      setForm({ note: '', interviewAt: '' });
      changed();
    } catch (e) {
      setMsg(e.message);
    }
  };
  const addNote = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/manage/applications/${id}/notes`, { text: noteText });
      setNoteText('');
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <Loader loading={loading} error={error}>
      {data && (() => {
        const { application: a, match } = data;
        const p = a.applicant;
        return (
          <aside className="card stack">
            <div className="row between">
              <div><h2>{p.name}</h2><p className="muted">{p.headline || 'No headline'}</p></div>
              <StatusBadge status={a.status} />
            </div>
            <p className="small muted">Applied for <strong>{a.job.title}</strong>. {p.email}, {p.location || 'location not set'}, {p.experienceYears} years of experience.{' '}
              {p.resumeUrl && <a href={p.resumeUrl} target="_blank" rel="noreferrer">Resume</a>}</p>
            <MatchMeter score={match.score} />
            <SkillChips skills={a.job.skills} match={match} />
            {p.bio && <section><h3>About</h3><p className="prose">{p.bio}</p></section>}
            {a.coverLetter && <section><h3>Cover letter</h3><p className="prose">{a.coverLetter}</p></section>}
            {a.interviewAt && <Notice kind="success">Interview: {fmtDateTime(a.interviewAt)}</Notice>}
            <Notice kind="error">{msg}</Notice>
            {TRANSITIONS[a.status].length > 0 && (
              <section className="stack">
                <div className="row">
                  {TRANSITIONS[a.status].map((s) => (
                    <button key={s} className={`btn small ${s === 'rejected' ? 'danger' : ''}`} aria-pressed={action === s} onClick={() => { setAction(action === s ? null : s); setMsg(''); }}>{ACTION_LABEL[s]}</button>
                  ))}
                </div>
                {action && (
                  <div className="stack">
                    {action === 'interview' && <Field label="Interview date and time"><input type="datetime-local" required value={form.interviewAt} onChange={(e) => setForm({ ...form, interviewAt: e.target.value })} /></Field>}
                    <Field label="Message to the candidate (optional)"><input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
                    <div><button className="btn" onClick={confirm}>Confirm: {ACTION_LABEL[action]}</button></div>
                  </div>
                )}
              </section>
            )}
            <section>
              <h3>History</h3>
              <ul className="timeline">
                {a.history.map((h, i) => <li key={i}><strong>{STATUS_LABEL[h.status]}</strong> <span className="muted">{fmtDateTime(h.at)}{h.by ? `, ${h.by.name}` : ''}</span>{h.note && <div className="muted">{h.note}</div>}</li>)}
              </ul>
            </section>
            <section className="stack">
              <h3>Internal notes</h3>
              <p className="muted small">Only your company can see these.</p>
              {a.notes.map((n) => <p key={n._id} className="small"><strong>{n.author?.name}</strong> <span className="muted">{timeAgo(n.at)}</span><br />{n.text}</p>)}
              <form className="row" onSubmit={addNote}>
                <input style={{ flex: 1 }} aria-label="Add a note" required maxLength={1000} placeholder="Add a note for your team" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button className="btn small">Add note</button>
              </form>
            </section>
          </aside>
        );
      })()}
    </Loader>
  );
}

export function Applicants() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const job = params.get('job') || '';
  const status = params.get('status') || '';
  const jobs = useFetch(() => api.get('/manage/jobs'), []);
  const { data, loading, error, reload } = useFetch(() => api.get(`/manage/applications${qs({ job, status, q: search, page, limit: 10 })}`), [job, status, search, page]);

  const setFilter = (k) => (e) => {
    const next = new URLSearchParams(params);
    e.target.value ? next.set(k, e.target.value) : next.delete(k);
    setParams(next);
    setPage(1);
    setSelected(null);
  };

  return (
    <>
      <PageHead title="Applicants" />
      <form className="row" style={{ marginBottom: '1rem' }} onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <select aria-label="Filter by job" value={job} onChange={setFilter('job')} style={{ maxWidth: 260 }}>
          <option value="">All jobs</option>
          {jobs.data?.items.map((j) => <option key={j._id} value={j._id}>{j.title}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={setFilter('status')} style={{ maxWidth: 180 }}>
          <option value="">Any status</option>
          {PIPELINE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input aria-label="Search by name" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />
        <button className="btn ghost">Search</button>
      </form>
      <div className="split">
        <div className="stack">
          <Loader loading={loading} error={error}>
            {data?.items.length ? data.items.map((a) => (
              <button key={a._id} className="list-item" aria-current={selected === a._id} onClick={() => setSelected(a._id)}>
                <div className="row between"><strong>{a.applicant.name}</strong><StatusBadge status={a.status} /></div>
                <div className="meta"><span>{a.job.title}</span><span>{a.matchScore}% match</span><span>{timeAgo(a.createdAt)}</span></div>
              </button>
            )) : <Empty title="No applicants found">Applications appear here as candidates apply.</Empty>}
            <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
          </Loader>
        </div>
        {selected ? <ApplicantPanel id={selected} onChanged={reload} /> : <div className="empty">Select an applicant to review their profile, move them through the pipeline, and leave notes.</div>}
      </div>
    </>
  );
}

/* ------------------------------ recruiters ------------------------------ */
export function Recruiters() {
  const { data, loading, error, reload } = useFetch(() => api.get('/manage/recruiters'), []);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post('/manage/recruiters', form);
      setForm({ name: '', email: '', password: '' });
      setMsg({ kind: 'success', text: 'Recruiter added. Share their email and password with them.' });
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
  };
  const toggle = async (r) => {
    await api.patch(`/manage/recruiters/${r._id}`, { active: !r.active });
    reload();
  };

  return (
    <>
      <PageHead title="Recruiters" />
      <div className="grid two">
        <form className="card stack" onSubmit={add} style={{ alignSelf: 'start' }}>
          <h2>Add a recruiter</h2>
          <Notice kind={msg.kind}>{msg.text}</Notice>
          <Field label="Name"><input required value={form.name} onChange={set('name')} /></Field>
          <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Temporary password" hint="At least 8 characters"><input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
          <div><button className="btn">Add recruiter</button></div>
        </form>
        <Loader loading={loading} error={error}>
          {data?.items.length ? (
            <div className="card flat table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r._id}><td>{r.name}<div className="muted small">{r.email}</div></td><td><span className={`badge ${r.active ? 's-open' : 's-closed'}`}>{r.active ? 'Active' : 'Deactivated'}</span></td>
                      <td><button className="btn ghost small" onClick={() => toggle(r)}>{r.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No recruiters yet">Recruiters can post jobs and review applicants for your company.</Empty>}
        </Loader>
      </div>
    </>
  );
}

/* --------------------------- company profile --------------------------- */
export function CompanyProfile() {
  const { refresh } = useAuth();
  const { data, loading, error } = useFetch(() => api.get('/manage/company'), []);
  return (
    <>
      <PageHead title="Company profile" />
      <Loader loading={loading} error={error}>{data && <CompanyForm company={data.company} onSaved={refresh} />}</Loader>
    </>
  );
}

function CompanyForm({ company, onSaved }) {
  const [f, setF] = useState({ name: company.name || '', description: company.description || '', website: company.website || '', industry: company.industry || '', size: company.size || '1-10', location: company.location || '' });
  const [msg, setMsg] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/manage/company', f);
      onSaved();
      setMsg({ kind: 'success', text: 'Company profile saved' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
  };
  return (
    <form className="card stack" onSubmit={save}>
      <p>Status: <StatusBadge status={company.status} /> {company.statusReason && <span className="muted">{company.statusReason}</span>}</p>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <div className="form-grid">
        <Field label="Company name"><input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Industry"><input value={f.industry} onChange={set('industry')} /></Field>
        <Field label="Location"><input value={f.location} onChange={set('location')} /></Field>
        <Field label="Company size"><select value={f.size} onChange={set('size')}>{['1-10', '11-50', '51-200', '201-1000', '1000+'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="full"><Field label="Website"><input type="url" value={f.website} onChange={set('website')} placeholder="https://" /></Field></div>
        <div className="full"><Field label="About the company"><textarea value={f.description} onChange={set('description')} maxLength={3000} /></Field></div>
      </div>
      <div><button className="btn">Save company</button></div>
    </form>
  );
}
