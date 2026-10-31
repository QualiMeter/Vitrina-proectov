// frontend/src/pages/auth/VerifyEmailPage.tsx
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const location = useLocation();
  const emailFromState = (location.state as any)?.email as string | undefined;
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    setStatus('verifying');
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Email успешно подтверждён. Теперь вы можете войти.');
      })
      .catch(() => {
        setStatus('error');
        setMessage('Ссылка недействительна или истекла. Запросите новое письмо.');
      });
  }, [token]);

  async function handleResend() {
    if (!emailFromState) return;
    try {
      await resendVerification(emailFromState);
      setMessage('Письмо отправлено повторно. Проверьте почту.');
    } catch {
      setMessage('Не удалось отправить письмо. Попробуйте позже.');
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Подтверждение email</h1>
        {status === 'verifying' && <p>Проверяем ссылку…</p>}
        {status === 'success' && <p className="auth-success">{message}</p>}
        {status === 'error' && <p className="auth-error">{message}</p>}
        {!token && emailFromState && (
          <>
            <p>На адрес <strong>{emailFromState}</strong> отправлено письмо с ссылкой для подтверждения.</p>
            <Button onClick={handleResend}>Отправить повторно</Button>
          </>
        )}
        {!token && !emailFromState && (
          <p>Проверьте почту и перейдите по ссылке из письма.</p>
        )}
        <p className="auth-footer"><Link to="/login">Перейти ко входу</Link></p>
      </Card>
    </div>
  );
}