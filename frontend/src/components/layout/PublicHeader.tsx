import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { Button, ButtonLink } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function PublicHeader() {
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return <>
    <header className="public-header" onKeyDown={(event) => {
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
        event.currentTarget.querySelector<HTMLButtonElement>('.public-header__menu')?.focus();
      }
    }}>
      <div className="container public-header__inner">
        <Brand />
        <Button
          variant="ghost"
          className="public-header__menu"
          aria-controls="public-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
        >
          <span aria-hidden="true">☰</span>
        </Button>
        <nav
          id="public-navigation"
          className={menuOpen ? 'is-open' : ''}
          aria-label="Основная навигация"
        >
          <a href="/#about" onClick={() => setMenuOpen(false)}>О платформе</a>
          <a href="/#directions" onClick={() => setMenuOpen(false)}>Направления</a>
          <Link to="/cases" onClick={() => setMenuOpen(false)}>Каталог кейсов</Link>
        </nav>
        <Button variant="secondary" onClick={() => setShowLogin(true)}>Войти</Button>
      </div>
    </header>
    <Modal open={showLogin} title="Вход в сервис" onClose={() => setShowLogin(false)}>
      <p>Подключение университетской системы входа находится в разработке. Сейчас авторизация недоступна.</p>
      <ButtonLink to="/company/cases" onClick={() => setShowLogin(false)}>Кабинет компании — демо</ButtonLink>
    </Modal>
  </>;
}
