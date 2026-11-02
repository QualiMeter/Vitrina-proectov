import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvitation, previewInvitation, PRIVACY_POLICY_VERSION, type InvitationPreview } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../features/auth/useAuth';
import { clearPendingInvitationToken, setPendingInvitationToken } from '../../features/auth/pendingInvitation';

function invitationError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Не удалось проверить приглашение. Попробуйте позже.';
  if (error.status === 429) return 'Слишком много запросов. Подождите немного и попробуйте снова.';
  if (error.status === 400) return 'Ссылка приглашения повреждена. Запросите новое приглашение.';
  if (error.status === 401) return 'Войдите в аккаунт, указанный в приглашении.';
  if (error.status === 403) return 'Приглашение предназначено для другого пользователя.';
  if (error.status === 404 || error.code === 'invalid_invitation') return 'Приглашение истекло или уже использовано. Запросите новое.';
  if (error.status === 409) return 'Аккаунт уже существует или уже состоит в этой компании. Войдите в него.';
  return 'Не удалось выполнить действие с приглашением. Попробуйте позже.';
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session, isLoading: authLoading, adoptSession } = useAuth();
  const [token, setToken] = useState(() => params.get('token') ?? (location.state as { invitationToken?: string } | null)?.invitationToken ?? '');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const preservePendingOnUnmount = useRef(false);

  useEffect(() => {
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      setPendingInvitationToken(urlToken);
      navigate('/accept-invitation', { replace: true, state: location.state });
    }
  }, [params, navigate, location.state]);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      setError('В ссылке нет токена приглашения. Запросите новое приглашение.');
      return () => { active = false; };
    }
    setLoading(true);
    previewInvitation(token).then((data) => {
      if (active) { setPreview(data); setError(''); }
    }).catch((cause: unknown) => {
      if (active) {
        setPreview(null);
        setError(invitationError(cause));
        if (cause instanceof ApiError && [400, 403, 404].includes(cause.status ?? 0)) {
          clearPendingInvitationToken();
          setToken('');
        }
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function handleAccept(event: React.FormEvent) {
    event.preventDefault();
    if (!preview || submitting.current) return;
    if (mode === 'new' && !privacyAccepted) {
      setError('Необходимо согласие на обработку персональных данных.');
      return;
    }
    submitting.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await acceptInvitation(mode === 'existing'
        ? { mode, token }
        : { mode, token, fullName, password, privacyAccepted: true, privacyPolicyVersion: PRIVACY_POLICY_VERSION });
      clearPendingInvitationToken();
      setToken('');
      adoptSession(result);
      navigate('/company', { replace: true });
    } catch (cause: unknown) {
      setError(invitationError(cause));
    } finally {
      submitting.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => () => {
    if (!preservePendingOnUnmount.current) {
      clearPendingInvitationToken();
    }
  }, []);

  const loginReturn = { from: { pathname: '/accept-invitation' }, pendingInvitation: true };
  return <div className="auth-page"><Card>
    <h1>Приглашение в компанию</h1>
    {loading || authLoading ? <p role="status">Проверяем приглашение…</p> : preview ? <>
      <p>Компания: <strong>{preview.companyName}</strong></p>
      <p>Роль: <strong>{preview.role === 'OWNER' ? 'Владелец' : 'Участник'}</strong></p>
      <p>Адрес получателя: <strong>{preview.maskedEmail}</strong></p>
      <p>Действует до {new Date(preview.expiresAt).toLocaleString()}.</p>
      {!session && <div className="auth-links" role="group" aria-label="Способ принятия приглашения">
        <button type="button" aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>У меня есть аккаунт</button>
        <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Создать аккаунт</button>
      </div>}
      {mode === 'existing' && !session ? <p>Чтобы продолжить с существующим аккаунтом, <Link to="/login" state={loginReturn} onClick={() => {
        preservePendingOnUnmount.current = true;
        setPendingInvitationToken(token);
      }}>войдите</Link>. После входа вы вернётесь к приглашению.</p> : null}
      <form onSubmit={handleAccept}>
        {mode === 'new' && !session && <>
          <Input label="ФИО" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={200} autoComplete="name" />
          <Input label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" />
          <label className="auth-checkbox"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />Принимаю политику обработки персональных данных (версия {PRIVACY_POLICY_VERSION})</label>
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {(session || mode === 'new') && <Button type="submit" disabled={submitting}>{submitting ? 'Принимаем…' : 'Подтвердить и принять приглашение'}</Button>}
      </form>
    </> : <p className="auth-error" role="alert">{error}</p>}
  </Card></div>;
}
