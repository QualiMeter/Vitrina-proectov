import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    consentPd: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consentPd) {
      setError('Необходимо согласие на обработку персональных данных.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err: unknown) {
  const status = (err as { status?: number })?.status;
  if (status === 409) {
        setError('Пользователь с таким email уже зарегистрирован.');
      } else {
        setError('Ошибка регистрации. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h1>Регистрация студента</h1>
        <form onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          <Input label="Пароль" type="password" value={form.password} onChange={e => update('password', e.target.value)} required minLength={8} />
          <Input label="Имя" value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
          <Input label="Фамилия" value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={form.consentPd}
              onChange={e => update('consentPd', e.target.checked)}
            />
            Согласен на обработку персональных данных
          </label>
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Регистрация…' : 'Зарегистрироваться'}</Button>
        </form>
        <p className="auth-footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </Card>
    </div>
  );
}