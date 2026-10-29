import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import { Spinner } from './ui';
import { roleHome } from './utils';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import { Login, Register } from './pages/Auth';
import { SeekerDashboard, SeekerProfile, SavedJobs } from './pages/Seeker';
import { Overview, ManageJobs, Applicants, Recruiters, CompanyProfile } from './pages/Manage';
import { AdminOverview, AdminCompanies, AdminUsers, AdminJobs } from './pages/Admin';
import Notifications from './pages/Notifications';

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

const NAV = {
  guest: [['/jobs', 'Browse jobs']],
  jobseeker: [['/jobs', 'Browse jobs'], ['/dashboard', 'My applications'], ['/saved', 'Saved'], ['/profile', 'Profile']],
  company: [['/manage', 'Overview', true], ['/manage/jobs', 'Jobs'], ['/manage/applicants', 'Applicants'], ['/manage/recruiters', 'Recruiters'], ['/manage/company', 'Company']],
  recruiter: [['/manage', 'Overview', true], ['/manage/jobs', 'Jobs'], ['/manage/applicants', 'Applicants']],
  admin: [['/admin', 'Overview', true], ['/admin/companies', 'Companies'], ['/admin/users', 'Users'], ['/admin/jobs', 'Jobs']],
};

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return setUnread(0);
    let live = true;
    const poll = () => api.get('/notifications?limit=1').then((d) => live && setUnread(d.unread)).catch(() => {});
    poll();
    const id = setInterval(poll, 30000);
    window.addEventListener('skillsync:notifications', poll);
    return () => {
      live = false;
      clearInterval(id);
      window.removeEventListener('skillsync:notifications', poll);
    };
  }, [user]);

  const links = NAV[user ? user.role : 'guest'];
  return (
    <header className="site-header">
      <div className="wrap">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          SkillSync
        </Link>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
        <div className="row">
          {user ? (
            <>
              <Link to="/notifications" className="btn ghost small bell" aria-label={`Notifications, ${unread} unread`}>
                Alerts{unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <span className="small muted">{user.name}</span>
              <button className="btn ghost small" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn ghost small">Sign in</Link>
              <Link to="/register" className="btn small">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<RequireRole roles={['jobseeker']}><SeekerDashboard /></RequireRole>} />
          <Route path="/saved" element={<RequireRole roles={['jobseeker']}><SavedJobs /></RequireRole>} />
          <Route path="/profile" element={<RequireRole><SeekerProfile /></RequireRole>} />

          <Route path="/manage" element={<RequireRole roles={['company', 'recruiter']}><Overview /></RequireRole>} />
          <Route path="/manage/jobs" element={<RequireRole roles={['company', 'recruiter']}><ManageJobs /></RequireRole>} />
          <Route path="/manage/applicants" element={<RequireRole roles={['company', 'recruiter']}><Applicants /></RequireRole>} />
          <Route path="/manage/recruiters" element={<RequireRole roles={['company']}><Recruiters /></RequireRole>} />
          <Route path="/manage/company" element={<RequireRole roles={['company']}><CompanyProfile /></RequireRole>} />

          <Route path="/admin" element={<RequireRole roles={['admin']}><AdminOverview /></RequireRole>} />
          <Route path="/admin/companies" element={<RequireRole roles={['admin']}><AdminCompanies /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={['admin']}><AdminUsers /></RequireRole>} />
          <Route path="/admin/jobs" element={<RequireRole roles={['admin']}><AdminJobs /></RequireRole>} />

          <Route path="/notifications" element={<RequireRole><Notifications /></RequireRole>} />
          <Route path="*" element={<div className="empty"><strong>Page not found</strong><p><Link to="/">Go to the home page</Link></p></div>} />
        </Routes>
      </main>
      <footer>
        <div className="wrap">SkillSync matches people and roles on the skills that matter.</div>
      </footer>
    </>
  );
}
