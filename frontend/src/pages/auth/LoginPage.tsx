import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { ApiError } from '../../api/client';
import { clearPendingInvitationToken, takePendingInvitationToken } from '../../features/auth/pendingInvitation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  interface LocationState {
    from?: { pathname?: string };
  }
  const fromState = (location.state as LocationState | null)?.from;
  const candidate = fromState?.pathname;
  const from = candidate?.startsWith('/') && !candidate.startsWith('//')
    ? `${candidate}${(fromState as { search?: string } | undefined)?.search ?? ''}${(fromState as { hash?: string } | undefined)?.hash ?? ''}`
    : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  useEffect(() => () => {
    clearPendingInvitationToken();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      const invitationToken = takePendingInvitationToken();
      if (invitationToken) {
        navigate('/accept-invitation', { replace: true, state: { invitationToken } });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;
      setError(status === 429
        ? 'Слишком много попыток входа. Подождите немного и попробуйте снова.'
        : status === 401 || status === 403
          ? 'Не удалось войти. Проверьте email и пароль, а также подтверждение адреса.'
          : 'Не удалось войти. Попробуйте позже.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Вход</h1>
        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Забыли пароль?</Link>
          <Link to="/register">Регистрация</Link>
        </div>
      </Card>
    </div>
  );
}
