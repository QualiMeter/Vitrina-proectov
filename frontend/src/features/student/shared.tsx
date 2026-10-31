import { useContext, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ApiError } from "../../api/client";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/feedback/States";
import { DemoGatewayContext } from "./demoContext";
import { liveStudentGateway } from "./gateway";
import { StudentContext, errorMessage, safeUrl, useLoad } from "./hooks";
import "./student.css";

export function Load<T>({
  state,
  children,
}: {
  state: ReturnType<typeof useLoad<T>>;
  children: (data: T) => ReactNode;
}) {
  if (state.error)
    return (
      <ErrorState
        title={errorMessage(state.error)}
        action={<Button onClick={state.reload}>Повторить</Button>}
      />
    );
  if (state.data === undefined) return <LoadingState />;
  return <>{children(state.data)}</>;
}
export function ExternalLink({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  ) : (
    <span>{children} (ссылка недоступна)</span>
  );
}
const labels: Record<string, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "На рассмотрении",
  ADMITTED: "Допущен",
  REJECTED: "Отказ",
  WITHDRAWN: "Отозвана",
  ACTIVE: "Активен",
  ELIMINATED: "Выбыл",
  EXCLUDED: "Исключён",
  PENDING: "Ожидает решения",
  ACCEPTED: "Принято",
  DECLINED: "Отклонено",
  REVOKED: "Отозвано",
  EXPIRED: "Истекло",
  PASSED: "Прошёл",
  NOT_APPLICABLE: "Без отбора",
  EXECUTING: "Выполняется",
  REGISTRATION_OPEN: "Набор открыт",
  REGISTRATION_CLOSED: "Набор закрыт",
  FINAL_CLOSED: "Приём завершён",
  EVALUATING: "Подведение итогов",
  COMPLETED: "Завершён",
  CANCELED: "Отменён",
  MEMBER: "Участник",
  CAPTAIN: "Капитан",
  SOLO: "Индивидуально",
  TEAM: "Команда",
  CONFIRMED: "Подтверждено",
};
export function Status({ value }: { value: string }) {
  return <span className="badge badge--brand">{labels[value] ?? value}</span>;
}
export function StudentAvatar({
  id,
  present,
  nickname,
  demo,
}: {
  id: string;
  present: boolean;
  nickname: string;
  demo: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!present || failed || demo)
    return (
      <div className="student-avatar" aria-label="Аватар">
        {nickname.slice(0, 2).toUpperCase()}
      </div>
    );
  return (
    <img
      className="student-avatar"
      src={`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/public/students/${encodeURIComponent(id)}/avatar`}
      alt={`Аватар ${nickname}`}
      onError={() => setFailed(true)}
    />
  );
}
export function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (value: number) => void;
}) {
  return (
    <nav className="student-actions" aria-label="Страницы списка">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Назад
      </Button>
      <span>
        Страница {page} · всего {total}
      </span>
      <Button
        variant="secondary"
        disabled={page * 20 >= total}
        onClick={() => onPage(page + 1)}
      >
        Далее
      </Button>
    </nav>
  );
}

export function StudentRoot({ demo = false }: { demo?: boolean }) {
  const demoApi = useContext(DemoGatewayContext);
  const api = demo && demoApi ? demoApi : liveStudentGateway;
  const location = useLocation();
  const session = useLoad(() => api.session(), `session-${location.pathname}`);
  const { data: sessionData, reload: reloadSession } = session;
  const base = demo ? "/demo/student" : "/student";
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (demo) return;
    const verify = () => {
      void api.session().then((next) => {
        if (
          next.user.id !== sessionData?.user.id ||
          next.user.availableAreas.join(",") !==
            sessionData?.user.availableAreas.join(",")
        )
          reloadSession();
      }, reloadSession);
    };
    window.addEventListener("vitrina:session-expired", reloadSession);
    window.addEventListener("focus", verify);
    return () => {
      window.removeEventListener("vitrina:session-expired", reloadSession);
      window.removeEventListener("focus", verify);
    };
  }, [api, demo, sessionData, reloadSession]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  const links = [
    ["", "Обзор"],
    ["/profile", "Мой профиль"],
    ["/participations", "Мои участия"],
    ["/invitations", "Приглашения"],
    ["/portfolio", "Портфолио"],
    ["/projects", "Мои проекты"],
  ];
  return (
    <div className="student-app">
      <header className="student-header">
        <Brand compact />
        <span>Кабинет студента</span>
        <Button
          variant="secondary"
          aria-expanded={menu}
          aria-controls="student-nav"
          onClick={() => setMenu(!menu)}
        >
          Разделы
        </Button>
      </header>
      {demo && (
        <p className="student-demo" role="status">
          Демонстрация · данные и действия учебные, сохраняются только до
          обновления страницы. Реальный API не подключён.{" "}
          <Link to="/student">Рабочий кабинет</Link>
        </p>
      )}
      <div className="student-shell">
        <nav
          id="student-nav"
          aria-label="Кабинет студента"
          className={menu ? "student-nav is-open" : "student-nav"}
        >
          {links.map(([to, title]) => (
            <Link
              key={to}
              aria-current={
                location.pathname === base + to ? "page" : undefined
              }
              to={base + to}
            >
              {title}
            </Link>
          ))}
          <Link to={demo ? "/demo/student-projects" : "/student-projects"}>
            Каталог инициатив ↗
          </Link>
        </nav>
        <main className="student-main">
          <Load state={session}>
            {(data) =>
              data.user.availableAreas.includes("student") ? (
                <StudentContext.Provider
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
