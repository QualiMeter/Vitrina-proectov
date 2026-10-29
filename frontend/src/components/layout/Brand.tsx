import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="УУНиТ — Витрина ИТ-проектов, на главную">
    <img src="/uust-logo.png" alt="УУНиТ" width="155" height="50" />
    <span className="brand__service">Витрина<br />ИТ-проектов</span>
  </Link>;
}
