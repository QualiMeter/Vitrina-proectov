import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Brand } from './Brand';
import { Button } from '../ui/Button';
import './shell.css';

export type Area = 'university' | 'mentor' | 'admin';
const areas: Record<Area, { title: string; links: { label: string; to: string }[] }> = {
  university: { title: 'Сотрудник университета', links: [
    { label: 'Обзор', to: '/university' }, { label: 'Модерация', to: '/university/moderation' }, { label: 'Компании', to: '/university/companies' }, { label: 'Кураторы', to: '/university/curators' }, { label: 'Проекты', to: '/university/projects' }, { label: 'Отчёты', to: '/university/reports' }
  ] },
  mentor: { title: 'Куратор', links: [{ label: 'Проекты', to: '/mentor' }] },
  admin: { title: 'Администратор', links: [
    { label: 'Обзор', to: '/admin' }, { label: 'Пользователи', to: '/admin/users' }, { label: 'Справочники', to: '/admin/directories' }, { label: 'Компании', to: '/admin/companies' }, { label: 'Аудит', to: '/admin/audit' }
  ] }
};

export function Breadcrumbs({ area }: { area: Area }) {
  const location = useLocation();
  const current = areas[area].links.find((link) => link.to === location.pathname)?.label ?? 'Раздел';
  return <nav aria-label="Навигационная цепочка" className="breadcrumbs"><NavLink to="/">Главная</NavLink><span aria-hidden="true">/</span><span>{areas[area].title}</span><span aria-hidden="true">/</span><span aria-current="page">{current}</span></nav>;
}

export function Sidebar({ area, onNavigate }: { area: Area; onNavigate?: () => void }) {
  return <aside className="sidebar"><div className="sidebar__brand"><Brand compact /></div><div className="sidebar__caption">{areas[area].title}</div><nav aria-label="Разделы кабинета">
    {areas[area].links.map((link) => <NavLink key={link.to} end={link.to === `/${area}`} to={link.to} onClick={onNavigate} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>{link.label}</NavLink>)}
  </nav><div className="sidebar__foot">Разделы будут доступны после подключения авторизации и разрешений.</div></aside>;
}

export function AppShell({ area }: { area: Area }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="shell"><div id="cabinet-menu" className={`shell__sidebar ${menuOpen ? 'is-open' : ''}`}><Sidebar area={area} onNavigate={() => setMenuOpen(false)} /></div>
    {menuOpen && <button className="shell__scrim" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}
    <div className="shell__main"><header className="shell-header"><Button variant="ghost" className="shell-header__menu" aria-expanded={menuOpen} aria-controls="cabinet-menu" onClick={() => setMenuOpen(!menuOpen)}>☰ <span>Меню</span></Button><div className="shell-header__title">Витрина ИТ-проектов <span>/ {areas[area].title}</span></div><div className="shell-header__switch"><label htmlFor="area-switch">Доступные кабинеты</label><select id="area-switch" disabled value={area} aria-describedby="area-switch-hint"><option value={area}>{areas[area].title}</option></select><span id="area-switch-hint">После подключения прав</span></div></header><main className="shell__content"><Breadcrumbs area={area} /><Outlet /></main></div>
  </div>;
}

