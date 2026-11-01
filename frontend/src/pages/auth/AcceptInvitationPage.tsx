import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInvitation } from '../../api/auth';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../features/auth/useAuth';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Приглашение не содержит токен.');
      return;
    }
    setStatus('loading');
    acceptInvitation(token)
      .then((session) => {
        adoptSession(session);
        setStatus('success');
        navigate('/company', { replace: true });
      })
      .catch((err) => {
        setStatus('error');
        if (err?.status === 401) {
          setError('Ссылка недействительна или истекла. Запросите новое приглашение.');
        } else if (err?.status === 403) {
          setError('Приглашение предназначено для другого пользователя.');
        } else {
          setError('Не удалось принять приглашение. Попробуйте позже.');
        }
      });
  }, [token, navigate, adoptSession]);

  return (
    <div className="auth-page">
      <Card>
        <h1>Принятие приглашения</h1>
        {status === 'loading' && <p>Обработка приглашения…</p>}
        {status === 'error' && <p className="auth-error">{error}</p>}
        {status === 'success' && <p>Приглашение принято. Перенаправление…</p>}
      </Card>
    </div>
  );
}
