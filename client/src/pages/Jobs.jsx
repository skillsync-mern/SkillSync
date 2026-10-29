import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { useFetch, Loader, Empty, Pagination, SkillChips, MatchMeter, StatusBadge, Field, PageHead } from '../ui';
import { salaryRange, timeAgo } from '../utils';

export function JobCard({ job, onChange }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(job.saved);
  const toggleSave = async () => {
    const r = await api.post(`/jobs/${job._id}/save`);
    setSaved(r.saved);
    onChange?.();
  };
  const salary = salaryRange(job);
  return (
    <article className="card job-card">
      <div className="row between">
        <h3><Link to={`/jobs/${job._id}`}>{job.title}</Link></h3>
        {user?.role === 'jobseeker' && (
          <button className="btn ghost small" aria-pressed={!!saved} onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
        )}
      </div>
      <div className="meta">
        <span>{job.company?.name}</span>
        <span>{job.location}</span>
        <span>{job.type}, {job.workMode}</span>
        {salary && <span>{salary}</span>}
        <span>{timeAgo(job.createdAt)}</span>
      </div>
      <SkillChips skills={job.skills} match={job.match} />
      {job.match && <MatchMeter score={job.match.score} />}
      {job.applicationStatus && <div><StatusBadge status={job.applicationStatus} /></div>}
    </article>
  );
}

const FILTERS = ['q', 'location', 'type', 'workMode', 'skills', 'minSalary', 'sort'];

export default function Jobs() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const current = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) || '']));
  const [draft, setDraft] = useState(current);

  const { data, loading, error, reload } = useFetch(() => api.get(`/jobs${qs({ ...current, page, limit: 8 })}`), [params.toString(), user?._id]);

  const apply = (e) => {
    e.preventDefault();
    setParams(Object.fromEntries(Object.entries(draft).filter(([, v]) => v)));
  };
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const clear = () => {
    setDraft(Object.fromEntries(FILTERS.map((k) => [k, ''])));
    setParams({});
  };

  return (
    <>
      <PageHead title="Browse jobs" />
      <div className="jobs-layout">
        <form className="card filters" onSubmit={apply} aria-label="Filters">
          <Field label="Title or keyword"><input value={draft.q} onChange={set('q')} placeholder="e.g. React" /></Field>
          <Field label="Location"><input value={draft.location} onChange={set('location')} placeholder="e.g. Hyderabad" /></Field>
          <Field label="Job type">
            <select value={draft.type} onChange={set('type')}>
              <option value="">Any</option>
              {['full-time', 'part-time', 'contract', 'internship'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Work mode">
            <select value={draft.workMode} onChange={set('workMode')}>
              <option value="">Any</option>
              {['onsite', 'hybrid', 'remote'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Skills" hint="Separate with commas"><input value={draft.skills} onChange={set('skills')} placeholder="Python, SQL" /></Field>
          <Field label="Minimum yearly salary"><input type="number" min="0" step="100000" value={draft.minSalary} onChange={set('minSalary')} /></Field>
          <Field label="Sort by">
            <select value={draft.sort} onChange={set('sort')}>
              <option value="">Newest</option>
              <option value="salary">Highest salary</option>
            </select>
          </Field>
          <div className="row">
            <button className="btn">Apply filters</button>
            <button type="button" className="btn ghost" onClick={clear}>Clear</button>
          </div>
        </form>

        <div className="stack">
          <Loader loading={loading} error={error}>
            <p className="muted small">{data?.total} {data?.total === 1 ? 'job' : 'jobs'} found{user?.role === 'jobseeker' && user.skills?.length === 0 ? '. Add skills to your profile to see your match.' : ''}</p>
            {data?.items.length ? (
              data.items.map((j) => <JobCard key={j._id} job={j} onChange={reload} />)
            ) : (
              <Empty title="No jobs match these filters">Try removing a filter or searching a broader skill.</Empty>
            )}
            <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={(p) => setParams({ ...Object.fromEntries(params), page: p })} />
          </Loader>
        </div>
      </div>
    </>
  );
}
