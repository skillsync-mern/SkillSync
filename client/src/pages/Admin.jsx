import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { useFetch, Loader, Notice, Empty, StatusBadge, Pagination, PageHead } from '../ui';
import { fmtDate } from '../utils';

export function AdminOverview() {
  const { data, loading, error } = useFetch(() => api.get('/admin/stats'), []);
  const Tile = ({ n, label, to }) => <Link to={to} className="tile" style={{ textDecoration: 'none', color: 'inherit' }}><b>{n ?? 0}</b><span>{label}</span></Link>;
  return (
    <>
      <PageHead title="Platform overview" />
      <Loader loading={loading} error={error}>
        {data && (
          <div className="stack">
            {data.companies.pending > 0 && <Notice kind="warn">{data.companies.pending} {data.companies.pending === 1 ? 'company is' : 'companies are'} waiting for approval. <Link to="/admin/companies">Review now</Link></Notice>}
            <div className="grid tiles">
              <Tile n={data.users.total} label="Users" to="/admin/users" />
              <Tile n={data.users.jobseeker} label="Job seekers" to="/admin/users" />
              <Tile n={data.companies.approved} label="Approved companies" to="/admin/companies" />
              <Tile n={data.jobs.open} label="Open jobs" to="/admin/jobs" />
              <Tile n={data.applications.total} label="Applications" to="/admin/jobs" />
              <Tile n={data.applications.hired} label="Hires made" to="/admin/jobs" />
            </div>
          </div>
        )}
      </Loader>
    </>
  );
}

export function AdminCompanies() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/companies${qs({ status, page, limit: 10 })}`), [status, page]);

  const review = async (c, next) => {
    let reason;
    if (next === 'rejected') {
      reason = window.prompt('Why is this company being rejected? The owner will see this.');
      if (reason === null) return;
    }
    try {
      await api.patch(`/admin/companies/${c._id}/status`, { status: next, reason: reason || undefined });
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <PageHead title="Companies">
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
      </PageHead>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        {data?.items.length ? (
          <div className="card flat table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Owner</th><th>Jobs</th><th>Status</th><th>Registered</th><th /></tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c._id}>
                    <td><strong>{c.name}</strong><div className="muted small">{[c.industry, c.location].filter(Boolean).join(', ')}</div></td>
                    <td>{c.owner?.name}<div className="muted small">{c.owner?.email}</div></td>
                    <td>{c.jobCount}</td>
                    <td><StatusBadge status={c.status} />{c.statusReason && <div className="muted small">{c.statusReason}</div>}</td>
                    <td>{fmtDate(c.createdAt)}</td>
                    <td><div className="row">
                      {c.status !== 'approved' && <button className="btn small" onClick={() => review(c, 'approved')}>Approve</button>}
                      {c.status !== 'rejected' && <button className="btn danger small" onClick={() => review(c, 'rejected')}>Reject</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No companies here">Nothing matches this filter.</Empty>}
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
      </Loader>
    </>
  );
}

export function AdminUsers() {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/users${qs({ role, q: search, page, limit: 10 })}`), [role, search, page]);

  const toggle = async (u) => {
    try {
      await api.patch(`/admin/users/${u._id}`, { active: !u.active });
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <PageHead title="Users" />
      <form className="row" style={{ marginBottom: '1rem' }} onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
          <option value="">All roles</option><option value="jobseeker">Job seekers</option><option value="company">Company owners</option><option value="recruiter">Recruiters</option><option value="admin">Admins</option>
        </select>
        <input aria-label="Search users" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <button className="btn ghost">Search</button>
      </form>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        <div className="card flat table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Company</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}<div className="muted small">{u.email}</div></td>
                  <td>{u.role}</td><td>{u.company?.name || ''}</td><td>{fmtDate(u.createdAt)}</td>
                  <td><span className={`badge ${u.active ? 's-open' : 's-closed'}`}>{u.active ? 'Active' : 'Deactivated'}</span></td>
                  <td>{u.role !== 'admin' && <button className="btn ghost small" onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Reactivate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
      </Loader>
    </>
  );
}

export function AdminJobs() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get(`/admin/jobs${qs({ status, q: search, page, limit: 10 })}`), [status, search, page]);

  const setJobStatus = async (j, next) => {
    let reason;
    if (next === 'removed') {
      reason = window.prompt('Why is this job being removed? The poster will see this.');
      if (reason === null) return;
    }
    try {
      await api.patch(`/admin/jobs/${j._id}/status`, { status: next, reason: reason || undefined });
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <PageHead title="Job moderation" />
      <form className="row" style={{ marginBottom: '1rem' }} onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
          <option value="">Any status</option>{['open', 'draft', 'closed', 'removed'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input aria-label="Search jobs" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <button className="btn ghost">Search</button>
      </form>
      <Notice kind="error">{msg}</Notice>
      <Loader loading={loading} error={error}>
        {data?.items.length ? (
          <div className="card flat table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Company</th><th>Status</th><th>Posted</th><th /></tr></thead>
              <tbody>
                {data.items.map((j) => (
                  <tr key={j._id}>
                    <td><Link to={`/jobs/${j._id}`}>{j.title}</Link></td>
                    <td>{j.company?.name} {j.company?.status !== 'approved' && <StatusBadge status={j.company?.status} />}</td>
                    <td><StatusBadge status={j.status} /></td><td>{fmtDate(j.createdAt)}</td>
                    <td>
                      {j.status === 'removed'
                        ? <button className="btn ghost small" onClick={() => setJobStatus(j, 'open')}>Restore</button>
                        : <button className="btn danger small" onClick={() => setJobStatus(j, 'removed')}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No jobs found">Nothing matches this filter.</Empty>}
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
      </Loader>
    </>
  );
}
