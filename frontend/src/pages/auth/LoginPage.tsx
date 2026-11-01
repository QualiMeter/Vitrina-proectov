import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
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
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      setError(status === 401 || status === 403
        ? 'Не удалось войти. Проверьте email и пароль, а также подтверждение адреса.'
        : 'Не удалось войти. Попробуйте позже.');
    } finally {
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
