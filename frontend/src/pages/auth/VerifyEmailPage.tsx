import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../features/auth/useAuth';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get('token'));
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string } | null)?.email;
  const { adoptSession } = useAuth();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const verificationStarted = useRef<string | null>(null);
  const resendInProgress = useRef(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (!urlToken) return;
    setToken(urlToken);
    navigate('/verify-email', { replace: true, state: location.state });
  }, [searchParams, navigate, location.state]);

  useEffect(() => {
    if (!token || verificationStarted.current === token) return;
    verificationStarted.current = token;
    setStatus('verifying');
    verifyEmail(token)
      .then((session) => {
        adoptSession(session);
        setStatus('success');
        setMessage('Email подтверждён, вход выполнен.');
        setToken(null);
      })
      .catch((cause: unknown) => {
        setStatus('error');
        setMessage(cause instanceof ApiError && cause.status === 429
          ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
          : 'Ссылка недействительна или истекла. Запросите новое письмо.');
        if (!(cause instanceof ApiError && cause.status === 429)) {
          setToken(null);
        }
      });
  }, [token, adoptSession, verificationAttempt]);

  function retryVerification() {
    if (!token) return;
    verificationStarted.current = null;
    setVerificationAttempt(current => current + 1);
  }

  async function handleResend() {
    if (!emailFromState || resendInProgress.current) return;
    resendInProgress.current = true;
    setResending(true);
    try {
      await resendVerification(emailFromState);
      setMessage('Письмо отправлено повторно. Проверьте почту.');
    } catch (cause: unknown) {
      setMessage(cause instanceof ApiError && cause.status === 429
        ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
        : 'Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      resendInProgress.current = false;
      setResending(false);
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Подтверждение email</h1>
        {status === 'verifying' && <p>Проверяем ссылку…</p>}
        {status === 'success' && <p className="auth-success">{message}</p>}
        {status === 'error' && <p className="auth-error">{message}</p>}
        {status === 'error' && token && <Button onClick={retryVerification}>Повторить проверку</Button>}
        {!token && emailFromState && (
          <>
            <p>На адрес <strong>{emailFromState}</strong> отправлено письмо с ссылкой для подтверждения.</p>
            <Button onClick={handleResend} disabled={resending}>{resending ? 'Отправляем…' : 'Отправить повторно'}</Button>
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
