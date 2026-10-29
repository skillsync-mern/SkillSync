import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch, Loader, Notice, Empty, StatusBadge, SkillChips, Field, PageHead } from '../ui';
import { JobCard } from './Jobs';
import { STATUS_LABEL, fmtDate, fmtDateTime, splitSkills } from '../utils';

const ACTIVE = ['applied', 'reviewing', 'shortlisted', 'interview', 'offered'];

export function SeekerDashboard() {
  const { data, loading, error, reload } = useFetch(() => api.get('/applications/mine'), []);
  const [msg, setMsg] = useState('');

  const withdraw = async (id) => {
    if (!window.confirm('Withdraw this application?')) return;
    try {
      await api.post(`/applications/${id}/withdraw`);
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <PageHead title="My applications"><Link className="btn" to="/jobs">Find more jobs</Link></PageHead>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        {data?.items.length ? (
          <div className="stack">
            <div className="grid tiles">
              {['applied', 'interview', 'offered', 'hired'].map((s) => (
                <div className="tile" key={s}><b>{data.items.filter((a) => (s === 'applied' ? ACTIVE.includes(a.status) : a.status === s)).length}</b><span>{s === 'applied' ? 'Active' : STATUS_LABEL[s]}</span></div>
              ))}
            </div>
            {data.items.map((a) => (
              <article className="card stack" key={a._id}>
                <div className="row between">
                  <div>
                    <h3><Link to={`/jobs/${a.job._id}`}>{a.job.title}</Link></h3>
                    <div className="meta"><span>{a.company.name}</span><span>{a.job.location}</span><span>{a.matchScore}% skill match</span></div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.status === 'interview' && a.interviewAt && <Notice kind="success">Interview on {fmtDateTime(a.interviewAt)}</Notice>}
                <ul className="timeline">
                  {a.history.map((h, i) => (
                    <li key={i}><strong>{STATUS_LABEL[h.status]}</strong> <span className="muted">{fmtDate(h.at)}</span>{h.note && <div className="muted">{h.note}</div>}</li>
                  ))}
                </ul>
                {ACTIVE.includes(a.status) && <div><button className="btn ghost small" onClick={() => withdraw(a._id)}>Withdraw application</button></div>}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="You have not applied to any jobs yet"><Link to="/jobs">Browse jobs</Link> and apply to a role that fits your skills.</Empty>
        )}
      </Loader>
    </>
  );
}

export function SavedJobs() {
  const { data, loading, error, reload } = useFetch(() => api.get('/jobs/saved'), []);
  return (
    <>
      <PageHead title="Saved jobs" />
      <Loader loading={loading} error={error}>
        {data?.items.length ? <div className="stack">{data.items.map((j) => <JobCard key={j._id} job={j} onChange={reload} />)}</div> : <Empty title="Nothing saved yet">Use Save on any job to keep it here.</Empty>}
      </Loader>
    </>
  );
}

export function SeekerProfile() {
  const { user, setUser } = useAuth();
  const seeker = user.role === 'jobseeker';
  const [form, setForm] = useState({
    name: user.name || '',
    headline: user.headline || '',
    location: user.location || '',
    experienceYears: user.experienceYears ?? 0,
    skills: (user.skills || []).join(', '),
    bio: user.bio || '',
    resumeUrl: user.resumeUrl || '',
  });
  const [msg, setMsg] = useState({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = seeker ? { ...form, experienceYears: Number(form.experienceYears) || 0, skills: splitSkills(form.skills) } : { name: form.name };
      const { user: u } = await api.patch('/profile', body);
      setUser({ ...user, ...u });
      setMsg({ kind: 'success', text: 'Profile saved' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/profile/password', pw);
      setPw({ current: '', next: '' });
      setPwMsg({ kind: 'success', text: 'Password changed' });
    } catch (err) {
      setPwMsg({ kind: 'error', text: err.message });
    }
  };

  return (
    <>
      <PageHead title="Profile" />
      <div className="grid two">
        <form className="card stack" onSubmit={save}>
          <h2>{seeker ? 'Your skills and background' : 'Your account'}</h2>
          {seeker && <p className="muted small">Skills drive your match score on every job, so list the ones you actually use.</p>}
          <Notice kind={msg.kind}>{msg.text}</Notice>
          <div className="form-grid">
            <Field label="Name"><input required value={form.name} onChange={set('name')} /></Field>
            {seeker && (
              <>
                <Field label="Headline"><input value={form.headline} onChange={set('headline')} placeholder="e.g. Frontend developer" /></Field>
                <Field label="Location"><input value={form.location} onChange={set('location')} /></Field>
                <Field label="Years of experience"><input type="number" min="0" max="60" value={form.experienceYears} onChange={set('experienceYears')} /></Field>
                <div className="full"><Field label="Skills" hint="Separate with commas"><input value={form.skills} onChange={set('skills')} placeholder="React, Node.js, MongoDB" /></Field>
                  <SkillChips skills={splitSkills(form.skills)} /></div>
                <div className="full"><Field label="About you"><textarea value={form.bio} onChange={set('bio')} maxLength={2000} /></Field></div>
                <div className="full"><Field label="Resume link"><input type="url" value={form.resumeUrl} onChange={set('resumeUrl')} placeholder="https://" /></Field></div>
              </>
            )}
          </div>
          <div><button className="btn">Save profile</button></div>
        </form>
        <form className="card stack" onSubmit={changePassword} style={{ alignSelf: 'start' }}>
          <h2>Change password</h2>
          <Notice kind={pwMsg.kind}>{pwMsg.text}</Notice>
          <Field label="Current password"><input type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 8 characters"><input type="password" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
          <div><button className="btn">Change password</button></div>
        </form>
      </div>
    </>
  );
}
