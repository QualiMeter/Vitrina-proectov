import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export function PublicHeader() {
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return <><header className="public-header"><div className="container public-header__inner">
    <Brand />
    <nav id="public-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Основная навигация"><a href="#about" onClick={() => setMenuOpen(false)}>О платформе</a><a href="#directions" onClick={() => setMenuOpen(false)}>Направления</a><a href="#projects" onClick={() => setMenuOpen(false)}>Примеры проектов</a></nav>
    <Button variant="ghost" className="public-header__menu" aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню">☰</Button>
    <Link to="/login"><Button variant="secondary">Войти</Button></Link>
  </div></header>
  <Modal open={showLogin} title="Вход в сервис" onClose={() => setShowLogin(false)}>
    <p>Подключение университетской системы входа находится в разработке. Сейчас авторизация недоступна.</p>
  </Modal></>;
}
