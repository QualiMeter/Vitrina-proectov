import { useContext, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ApiError } from "../../api/client";
import { Brand } from "../../components/layout/Brand";
import { ErrorState } from "../../components/feedback/States";
import { DemoGatewayContext } from "./demoContext";
import { liveStudentGateway } from "./gateway";
import { StudentContext } from "./hooks";
import { Load, DemoNotice } from "./shared";
import { useStudentSession } from "./useStudentSession";
import "./student.css";

export function StudentRoot({ demo = false }: { demo?: boolean }) {
  const demoApi = useContext(DemoGatewayContext);
  const api = demo && demoApi ? demoApi : liveStudentGateway;
  const location = useLocation();
  const session = useStudentSession(api, demo);
  const base = demo ? "/demo/student" : "/student";
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    nav.current
      ?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
      ?.focus();
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  const links: [string, string, boolean][] = [
    ["", "Обзор", false],
    ["/profile", "Мой профиль", false],
    ["/participations", "Мои участия", false],
    ["/teams", "Команды", false],
    ["/portfolio", "Портфолио", false],
    ["/projects", "Мои проекты", false],
    ["/favorites", "Избранное", !demo],
    ["/notifications", "Уведомления", false],
  ];
  return (
    <div className="student-app">
      <header className="student-header">
        <div className="student-header-brand">
          <Brand compact />
          <span className="student-header-context">Кабинет студента</span>
        </div>
        <Link
          className="button button--secondary student-header-profile"
          to={`${base}/profile`}
        >
          Профиль
        </Link>
        <button
          ref={menuButton}
          className="button button--secondary student-menu-toggle"
          aria-label="Разделы"
          aria-expanded={menu}
          aria-controls="student-nav"
          onClick={() => setMenu(!menu)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d={menu ? "M6 6l12 12M18 6L6 18" : "M4 6h16M4 12h16M4 18h16"}
            />
          </svg>
        </button>
      </header>
      {demo && <DemoNotice />}
      <div className="student-shell">
        <nav
          ref={nav}
          id="student-nav"
          aria-label="Кабинет студента"
          className={menu ? "student-nav is-open" : "student-nav"}
        >
          {links.map(([to, title, upcoming]) => (
            <Link
              key={to}
              aria-current={
                location.pathname === base + to ||
                (to && location.pathname.startsWith(base + to + "/"))
                  ? "page"
                  : undefined
              }
              to={base + to}
            >
              <span>{title}</span>
              {upcoming && <small aria-hidden="true">Скоро</small>}
            </Link>
          ))}
          <Link to={demo ? "/demo/student-projects" : "/student-projects"}>
            <span>
              Каталог инициатив{" "}
              <span className="student-nav-arrow" aria-hidden="true">
                ↗
              </span>
            </span>
          </Link>
        </nav>
        <main className="student-main">
          <Load state={session}>
            {(data) =>
              data.user.availableAreas.includes("student") ? (
                <StudentContext.Provider
                  key={JSON.stringify([
                    data.user.id,
                    data.user.availableAreas,
                    data.user.globalRoles,
                    data.user.permissions,
                  ])}
                  value={{ api, demo, base, user: data.user }}
                >
                  <Outlet />
                </StudentContext.Provider>
              ) : (
                <ErrorState title="Кабинет студента недоступен" />
              )
            }
          </Load>
          {session.error instanceof ApiError &&
            session.error.status === 401 && (
              <p role="status">
                Общий экран входа ещё не подключён.{" "}
                <Link to="/">Вернуться на главную</Link> или повторите проверку
                сессии после входа через доступный экран команды.
              </p>
            )}
        </main>
      </div>
    </div>
  );
}
