import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AmbientBackground } from '../background/AmbientBackground';
import { Brand } from './Brand';
import { Button } from '../ui/Button';
import { useAuth } from '../../features/auth/useAuth';
import './shell.css';

export type Area = 'university' | 'mentor' | 'admin';
const areas: Record<Area, { title: string; links: { label: string; to: string; permission?: string }[] }> = {
  university: { title: 'Сотрудник университета', links: [
    { label: 'Обзор', to: '/university' },
    { label: 'Модерация', to: '/university/moderation' },
    { label: 'Компании', to: '/university/companies', permission: 'companies.listAll' },
    { label: 'Создать компанию', to: '/university/companies/new', permission: 'companies.create' },
    { label: 'Кураторы', to: '/university/curators' },
    { label: 'Проекты', to: '/university/projects' },
    { label: 'Отчёты', to: '/university/reports' },
  ] },
  mentor: { title: 'Куратор', links: [{ label: 'Проекты', to: '/mentor' }] },
  admin: { title: 'Администратор', links: [
    { label: 'Обзор', to: '/admin' }, { label: 'Пользователи', to: '/admin/users' }, { label: 'Справочники', to: '/admin/directories' }, { label: 'Компании', to: '/admin/companies' }, { label: 'Аудит', to: '/admin/audit' },
  ] },
};

export function Breadcrumbs({ area }: { area: Area }) {
  const location = useLocation();
  const current = areas[area].links.find((link) => link.to === location.pathname)?.label
    ?? (location.pathname.match(/^\/university\/companies\/[^/]+$/) ? 'Карточка компании' : 'Раздел');
  return <nav aria-label="Навигационная цепочка" className="breadcrumbs"><NavLink to="/">Главная</NavLink><span aria-hidden="true">/</span><span>{areas[area].title}</span><span aria-hidden="true">/</span><span aria-current="page">{current}</span></nav>;
}

export function Sidebar({ area, permissions, onNavigate }: { area: Area; permissions: string[]; onNavigate?: () => void }) {
  const links = areas[area].links.filter((link) => !link.permission || permissions.includes(link.permission));
  return <aside className="sidebar"><div className="sidebar__brand"><Brand compact /></div><div className="sidebar__caption">{areas[area].title}</div><nav aria-label="Разделы кабинета">
    {links.map((link) => <NavLink key={link.to} end={link.to === `/${area}`} to={link.to} onClick={onNavigate} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>{link.label}</NavLink>)}
  </nav><div className="sidebar__foot">Состав разделов зависит от разрешений вашей учётной записи.</div></aside>;
}

export function AppShell({ area }: { area: Area }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const availableAreas = session?.user.availableAreas ?? [];

  async function handleLogout() {
    setLogoutError(false);
    try { await logout(); navigate('/login', { replace: true }); }
    catch { setLogoutError(true); }
  }

  return <div className="shell"><div id="cabinet-menu" className={`shell__sidebar ${menuOpen ? 'is-open' : ''}`}><Sidebar area={area} permissions={session?.user.permissions ?? []} onNavigate={() => setMenuOpen(false)} /></div>
    {menuOpen && <button className="shell__scrim" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}
    <div className="shell__main"><header className="shell-header"><Button variant="ghost" className="shell-header__menu" aria-expanded={menuOpen} aria-controls="cabinet-menu" onClick={() => setMenuOpen(!menuOpen)}>☰ <span>Меню</span></Button><div className="shell-header__title">Витрина ИТ-проектов <span>/ {areas[area].title}</span></div><div className="shell-header__account"><span>{session?.user.fullName}</span><label className="visually-hidden" htmlFor="area-switch">Перейти в кабинет</label><select id="area-switch" value={area} onChange={(event) => navigate(`/${event.target.value}`)} aria-label="Перейти в кабинет">{availableAreas.map((availableArea) => <option key={availableArea} value={availableArea}>{areas[availableArea as Area]?.title ?? 'Кабинет студента'}</option>)}</select><Button variant="ghost" onClick={() => void handleLogout()}>Выйти</Button></div></header>{logoutError && <p className="shell__logout-error" role="alert">Не удалось завершить сессию. Попробуйте ещё раз.</p>}<main className="shell__content"><AmbientBackground variant="dashboard" /><Breadcrumbs area={area} /><Outlet /></main></div>
  </div>;
}
