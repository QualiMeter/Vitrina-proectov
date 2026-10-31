import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError('Не удалось отправить запрос. Попробуйте позже.');
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
            <Button type="submit">Отправить ссылку</Button>
          </form>
        )}
        <p className="auth-footer"><Link to="/login">Вернуться ко входу</Link></p>
      </Card>
    </div>
  );
}