import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { LoadingState, ErrorState } from "../../components/feedback/States";
import { errorMessage, safeUrl, useLoad } from "./hooks";

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
  FINAL_CLOSED: "Приём финальных работ завершён",
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
  pageSize = 20,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (value: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (pages <= 1) return null;
  return (
    <nav className="student-actions student-pager" aria-label="Страницы списка">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Назад
      </Button>
      <span>
        Страница {page} из {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Далее
      </Button>
    </nav>
  );
}

export function DemoNotice() {
  return (
    <aside className="student-demo" aria-label="Демонстрационный режим">
      <span className="badge badge--brand student-demo-badge">
        UI Ready · демонстрационные данные
      </span>
      <details>
        <summary aria-label="О демонстрационном режиме">
          <span aria-hidden="true">ⓘ</span>
        </summary>
        <p>
          Учебные действия сохраняются до обновления страницы.{" "}
          <Link to="/student">Рабочий кабинет</Link>
        </p>
      </details>
    </aside>
  );
}
