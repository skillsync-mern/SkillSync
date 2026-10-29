import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { Notice, Field } from '../ui';
import { roleHome } from '../utils';

function useSubmit(action) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return { error, busy, run };
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const { error, busy, run } = useSubmit(async () => {
    const u = await login(form.email, form.password);
    navigate(location.state?.from || roleHome(u.role), { replace: true });
  });
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return (
    <form className="card stack" style={{ maxWidth: 420, margin: '2rem auto' }} onSubmit={run}>
      <h1>Sign in</h1>
      <Notice kind="error">{error}</Notice>
      <Field label="Email"><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Password"><input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="muted small">New to SkillSync? <Link to="/register">Create an account</Link></p>
    </form>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'company' ? 'company' : 'jobseeker');
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', industry: '', location: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const { error, busy, run } = useSubmit(async () => {
    const body = { name: form.name, email: form.email, password: form.password, role, location: form.location || undefined };
    if (role === 'company') Object.assign(body, { companyName: form.companyName, industry: form.industry || undefined });
    const u = await register(body);
    navigate(roleHome(u.role), { replace: true });
  });
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return (
    <form className="card stack" style={{ maxWidth: 560, margin: '2rem auto' }} onSubmit={run}>
      <h1>Create your account</h1>
      <div className="seg" role="group" aria-label="Account type">
        <button type="button" aria-pressed={role === 'jobseeker'} onClick={() => setRole('jobseeker')}>I am looking for work</button>
        <button type="button" aria-pressed={role === 'company'} onClick={() => setRole('company')}>I am hiring</button>
      </div>
      <Notice kind="error">{error}</Notice>
      <div className="form-grid">
        <Field label="Your name"><input required value={form.name} onChange={set('name')} autoComplete="name" /></Field>
        <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label="Password" hint="At least 8 characters"><input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Location"><input value={form.location} onChange={set('location')} /></Field>
        {role === 'company' && (
          <>
            <Field label="Company name"><input required value={form.companyName} onChange={set('companyName')} /></Field>
            <Field label="Industry"><input value={form.industry} onChange={set('industry')} /></Field>
          </>
        )}
      </div>
      {role === 'company' && <Notice kind="warn">New companies are reviewed by an administrator before their jobs become public.</Notice>}
      <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      <p className="muted small">Already registered? <Link to="/login">Sign in</Link></p>
    </form>
  );
}
