import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Отсутствует токен сброса.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    setError(null);
    try {
      await resetPassword({ token, newPassword });
      setStatus('success');
    } catch (err: any) {
      setError(err?.status === 401 ? 'Ссылка недействительна или истекла.' : 'Ошибка сброса пароля.');
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
          <Button type="submit">Сменить пароль</Button>
        </form>
        <p className="auth-footer"><Link to="/login">Вернуться ко входу</Link></p>
      </Card>
    </div>
  );
}