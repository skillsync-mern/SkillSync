import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { useFetch, Loader, Empty } from '../ui';
import { JobCard } from './Jobs';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const summary = useFetch(() => api.get('/jobs/summary'), []);
  const latest = useFetch(() => api.get(`/jobs${qs({ limit: 6 })}`), [user?._id]);

  const search = (e) => {
    e.preventDefault();
    navigate(`/jobs${qs({ q, location })}`);
  };

  return (
    <>
      <section className="hero">
        <div>
          <h1>Hire and get hired on skills, not keywords.</h1>
          <p className="lead">Every role lists the skills it needs. Every profile lists the skills you have. SkillSync shows you exactly where they overlap.</p>
          <form className="hero-search" onSubmit={search} role="search">
            <input aria-label="Job title or skill" placeholder="Job title or skill" value={q} onChange={(e) => setQ(e.target.value)} />
            <input aria-label="Location" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <button className="btn">Search jobs</button>
          </form>
        </div>
        <div className="venn" aria-label="Open roles and hiring companies">
          <div className="l"><span><b>{summary.data?.openJobs ?? '–'}</b>open roles</span></div>
          <div className="r"><span><b>{summary.data?.companies ?? '–'}</b>companies hiring</span></div>
        </div>
      </section>

      <section className="stack">
        <div className="row between">
          <h2>Latest roles</h2>
          <Link to="/jobs">See all jobs</Link>
        </div>
        <Loader loading={latest.loading} error={latest.error}>
          {latest.data?.items.length ? (
            <div className="grid two">{latest.data.items.map((j) => <JobCard key={j._id} job={j} onChange={latest.reload} />)}</div>
          ) : (
            <Empty title="No open roles yet">Companies are being approved. Check back soon.</Empty>
          )}
        </Loader>
        {!user && (
          <div className="card row between">
            <div>
              <h3>Hiring for your team?</h3>
              <p className="muted">Register your company, add recruiters, and review candidates ranked by skill match.</p>
            </div>
            <Link className="btn" to="/register?role=company">Register your company</Link>
          </div>
        )}
      </section>
    </>
  );
}
