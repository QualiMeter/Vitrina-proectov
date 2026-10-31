import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInvitation } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
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
      .then(() => {
        setStatus('success');
        // После принятия приглашения пользователь должен войти (если ещё не вошёл)
        // или быть перенаправлен в кабинет компании.
        navigate('/login', { state: { invitationAccepted: true } });
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
  }, [token, navigate]);

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