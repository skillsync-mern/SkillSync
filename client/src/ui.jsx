import { useState, useEffect, useCallback } from 'react';
import { STATUS_LABEL } from './utils';

export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error: error.message, loading: false }));
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export const Notice = ({ kind = 'info', children }) =>
  children ? (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  ) : null;

export const Empty = ({ title, children }) => (
  <div className="empty">
    <strong>{title}</strong>
    {children && <p>{children}</p>}
  </div>
);

export function Loader({ loading, error, children }) {
  if (loading) return <Spinner />;
  if (error) return <Notice kind="error">{error}</Notice>;
  return children;
}

export const StatusBadge = ({ status }) => <span className={`badge s-${status}`}>{STATUS_LABEL[status] || status}</span>;

// Skills the candidate has are filled; skills they lack are outlined.
export function SkillChips({ skills = [], match }) {
  const have = new Set((match?.matched || []).map((s) => s.toLowerCase()));
  return (
    <ul className="chips">
      {skills.map((s) => (
        <li key={s} className={match ? (have.has(s.toLowerCase()) ? 'chip have' : 'chip lack') : 'chip'}>
          {s}
        </li>
      ))}
    </ul>
  );
}

export function MatchMeter({ score }) {
  const filled = Math.round(score / 10);
  return (
    <div className="meter" role="img" aria-label={`${score}% skill match`}>
      <div className="meter-bars" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : ''} />
        ))}
      </div>
      <span className="meter-label">{score}% skill match</span>
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="btn ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export const Field = ({ label, hint, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

export const PageHead = ({ title, children }) => (
  <div className="page-head">
    <h1>{title}</h1>
    <div className="page-actions">{children}</div>
  </div>
);
