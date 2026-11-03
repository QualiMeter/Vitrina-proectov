import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (cause: unknown) {
      setError(cause instanceof ApiError && cause.status === 429
        ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
        : 'Не удалось отправить запрос. Попробуйте позже.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Восстановление пароля</h1>
        {sent ? (
          <p>Если адрес существует, на него отправлено письмо со ссылкой для сброса пароля.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? 'Отправляем…' : 'Отправить ссылку'}</Button>
          </form>
        )}
        <p className="auth-footer"><Link to="/login">Вернуться ко входу</Link></p>
      </Card>
    </div>
  );
}
