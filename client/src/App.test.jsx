import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth';
import { RequireRole } from './App';
import { Login } from './pages/Auth';
import { MatchMeter, SkillChips } from './ui';

function mockApi(user) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).endsWith('/auth/me')) {
      return user ? { ok: true, status: 200, json: async () => ({ user }) } : { ok: false, status: 401, json: async () => ({ error: 'Please sign in to continue' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  }));
  if (user) localStorage.setItem('skillsync_token', 'test-token');
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Seeker dashboard</div>} />
          <Route path="/admin" element={<RequireRole roles={['admin']}><div>Admin area</div></RequireRole>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('route protection', () => {
  test('signed-out visitors are sent to the sign-in page', async () => {
    mockApi(null);
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  test('a job seeker cannot open the admin area and lands on their dashboard', async () => {
    mockApi({ _id: '1', name: 'Naga', role: 'jobseeker' });
    renderAt('/admin');
    expect(await screen.findByText('Seeker dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  test('an admin can open the admin area', async () => {
    mockApi({ _id: '2', name: 'Admin', role: 'admin' });
    renderAt('/admin');
    await waitFor(() => expect(screen.getByText('Admin area')).toBeInTheDocument());
  });
});

describe('skill match components', () => {
  test('the meter exposes the score to assistive tech', () => {
    render(<MatchMeter score={80} />);
    expect(screen.getByRole('img', { name: '80% skill match' })).toBeInTheDocument();
  });

  test('chips distinguish skills the candidate has from ones they lack', () => {
    render(<SkillChips skills={['React', 'Docker']} match={{ matched: ['react'], missing: ['Docker'] }} />);
    expect(screen.getByText('React')).toHaveClass('have');
    expect(screen.getByText('Docker')).toHaveClass('lack');
  });
});
