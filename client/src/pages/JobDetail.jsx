import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFetch, Loader, Notice, SkillChips, MatchMeter, StatusBadge, Field } from '../ui';
import { salaryRange, fmtDate } from '../utils';

function ApplyPanel({ job, onDone }) {
  const { user } = useAuth();
  const [coverLetter, setCoverLetter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <Link className="btn" to="/login" state={{ from: `/jobs/${job._id}` }}>Sign in to apply</Link>;
  if (user.role !== 'jobseeker') {
    const own = ['company', 'recruiter'].includes(user.role) && String(user.company?._id || user.company) === String(job.company._id);
    return <p className="muted small">{own ? <>This is your company's posting. <Link to="/manage/jobs">Manage jobs</Link></> : 'Only job seekers can apply.'}</p>;
  }
  if (job.applicationStatus) return <div className="row"><span>Your application:</span><StatusBadge status={job.applicationStatus} /><Link to="/dashboard">Track it</Link></div>;
  if (!job.acceptingApplications) return <Notice kind="warn">This job is no longer accepting applications.</Notice>;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/jobs/${job._id}/apply`, { coverLetter });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack" onSubmit={submit}>
      <Notice kind="error">{error}</Notice>
      <Field label="Cover letter (optional)"><textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} maxLength={3000} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Applying…' : 'Apply for this job'}</button>
    </form>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get(`/jobs/${id}`), [id, user?._id]);

  return (
    <Loader loading={loading} error={error}>
      {data && (() => {
        const job = data.job;
        const salary = salaryRange(job);
        return (
          <div className="detail">
            <article className="card stack">
              <div>
                <h1>{job.title}</h1>
                <div className="meta">
                  <span>{job.company.name}</span><span>{job.location}</span>
                  <span>{job.type}, {job.workMode}</span>
                  {job.experienceMin > 0 && <span>{job.experienceMin}+ years of experience</span>}
                  {salary && <span>{salary}</span>}
                  {job.deadline && <span>Apply by {fmtDate(job.deadline)}</span>}
                </div>
              </div>
              {job.status !== 'open' && <Notice kind="warn">This job is {job.status} and not visible to candidates.</Notice>}
              <section><h2>About the role</h2><p className="prose">{job.description}</p></section>
              <section><h2>Skills needed</h2><SkillChips skills={job.skills} match={job.match} /></section>
              <section>
                <h2>About {job.company.name}</h2>
                <p className="prose">{job.company.description || 'No company description yet.'}</p>
                <p className="muted small">{[job.company.industry, job.company.size && `${job.company.size} people`, job.company.location].filter(Boolean).join(', ')}</p>
                {job.company.website && <a href={job.company.website} target="_blank" rel="noreferrer">{job.company.website}</a>}
              </section>
            </article>
            <aside className="card stack">
              {job.match && (
                <section>
                  <MatchMeter score={job.match.score} />
                  <p className="muted small">
                    {job.match.missing.length ? `You are missing: ${job.match.missing.join(', ')}.` : 'You have every skill this role lists.'}
                  </p>
                </section>
              )}
              <ApplyPanel job={job} onDone={reload} />
            </aside>
          </div>
        );
      })()}
    </Loader>
  );
}
