import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PRIVACY_POLICY_VERSION, register } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    nickname: '',
    privacyAccepted: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!form.privacyAccepted) {
      setError('Необходимо согласие на обработку персональных данных.');
      return;
    }
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        nickname: form.nickname,
        privacyAccepted: true,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      });
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err: unknown) {
  const status = (err as { status?: number })?.status;
  if (status === 409) {
        setError('Пользователь с таким email уже зарегистрирован.');
      } else {
        setError('Ошибка регистрации. Попробуйте позже.');
      }
    } finally {
      submitting.current = false;
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
          <Input label="ФИО" value={form.fullName} onChange={e => update('fullName', e.target.value)} required minLength={2} maxLength={200} autoComplete="name" />
          <Input label="Никнейм" value={form.nickname} onChange={e => update('nickname', e.target.value)} required minLength={2} maxLength={32} autoComplete="nickname" />
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={form.privacyAccepted}
              onChange={e => update('privacyAccepted', e.target.checked)}
            />
            Я принимаю политику обработки персональных данных (версия {PRIVACY_POLICY_VERSION})
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
