import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from './Brand';
import { Button, ButtonLink } from '../ui/Button';
import { useAuth } from '../../features/auth/useAuth';

const areaPaths = ['student', 'company', 'university', 'mentor', 'admin'] as const;

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const firstArea = areaPaths.find(area => session?.user.availableAreas.includes(area));
  const [logoutError, setLogoutError] = useState(false);

  async function handleLogout() {
    setLogoutError(false);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch {
      setLogoutError(true);
    }
  }

  return <header className="public-header"><div className="container public-header__inner">
    <Brand />
    <nav id="public-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Основная навигация">
      <a href="#about" onClick={() => setMenuOpen(false)}>О платформе</a>
      <a href="#directions" onClick={() => setMenuOpen(false)}>Направления</a>
      <a href="#projects" onClick={() => setMenuOpen(false)}>Примеры проектов</a>
    </nav>
    <Button variant="ghost" className="public-header__menu" aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню">☰</Button>
    {isLoading ? <span className="public-header__status" role="status">Проверяем вход…</span> : session ? (
      <div className="public-header__account">
        <span className="public-header__name">{session.user.fullName}</span>
        {firstArea ? <ButtonLink variant="secondary" to={`/${firstArea}`}>Кабинет</ButtonLink> : null}
        <Button variant="ghost" onClick={handleLogout}>Выйти</Button>
        {logoutError && <span className="public-header__error" role="alert">Не удалось выйти. Попробуйте ещё раз.</span>}
      </div>
    ) : <ButtonLink variant="secondary" to="/login">Войти</ButtonLink>}
  </div></header>;
}
