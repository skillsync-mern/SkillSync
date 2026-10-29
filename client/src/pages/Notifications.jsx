import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api';
import { useFetch, Loader, Empty, Pagination, PageHead } from '../ui';
import { timeAgo } from '../utils';

export default function Notifications() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get(`/notifications?page=${page}&limit=15`), [page]);
  const refreshBell = () => window.dispatchEvent(new Event('skillsync:notifications'));

  const open = async (n) => {
    if (!n.read) await api.post(`/notifications/${n._id}/read`).catch(() => {});
    refreshBell();
    if (n.link) navigate(n.link);
    else reload();
  };
  const readAll = async () => {
    await api.post('/notifications/read-all');
    refreshBell();
    reload();
  };

  return (
    <>
      <PageHead title="Notifications">
        <button className="btn ghost" onClick={readAll} disabled={!data?.unread}>Mark all as read</button>
      </PageHead>
      <Loader loading={loading} error={error}>
        {data?.items.length ? (
          <div className="card flat">
            {data.items.map((n) => (
              <button key={n._id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
                <span className="dot" aria-label={n.read ? 'Read' : 'Unread'} />
                <span>
                  <strong>{n.title}</strong>
                  <span className="muted" style={{ display: 'block' }}>{n.message}</span>
                  <span className="muted small">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="You are all caught up">Updates about applications, interviews and approvals will appear here.</Empty>
        )}
        <Pagination page={data?.page || 1} pages={data?.pages || 1} onChange={setPage} />
      </Loader>
    </>
  );
}
