import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get('token'));
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (!urlToken) return;
    setToken(urlToken);
    navigate('/reset-password', { replace: true });
  }, [searchParams, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!token) {
      setError('Отсутствует токен сброса.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await resetPassword({ token, newPassword });
      window.dispatchEvent(new Event('vitrina:session-expired'));
      setStatus('success');
      setToken(null);
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : undefined;
      setError(status === 429
        ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
        : status === 400 || status === 401 || status === 404
          ? 'Ссылка недействительна или истекла.'
          : status === 409 ? 'Этот запрос уже использован. Запросите новую ссылку.' : 'Не удалось сменить пароль. Попробуйте позже.');
      if (status === 400 || status === 401 || status === 404 || status === 409) {
        setToken(null);
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  if (status === 'success') {
    return (
      <div className="auth-page">
        <Card>
          <h1>Пароль изменён</h1>
          <p>Теперь вы можете войти с новым паролем.</p>
          <Link to="/login">Перейти ко входу</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Сброс пароля</h1>
        {error && <p className="auth-error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <Input label="Новый пароль" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
          <Input label="Подтверждение пароля" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <Button type="submit" disabled={loading}>{loading ? 'Сохраняем…' : 'Сменить пароль'}</Button>
        </form>
        <p className="auth-footer"><Link to="/login">Вернуться ко входу</Link></p>
      </Card>
    </div>
  );
}
