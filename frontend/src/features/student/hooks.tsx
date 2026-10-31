import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "../../api/client";
import type { StudentGateway } from "./gateway";
import type { AuthUser } from "./contracts";
type StudentContextValue = {
  api: StudentGateway;
  demo: boolean;
  base: string;
  user: AuthUser;
};
export const StudentContext = createContext<StudentContextValue | null>(null);
export function useStudent() {
  const value = useContext(StudentContext);
  if (!value) throw new Error("Student provider missing");
  return value;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 422)
      return "Проверьте заполненные поля и ограничения формы.";
    if (error.status === 429)
      return "Слишком много запросов. Подождите и повторите действие.";
    return {
      unauthorized: "Сессия завершилась. Войдите снова.",
      forbidden: "Недостаточно прав. Данные и действия недоступны.",
      notFound: "Объект не найден или недоступен.",
      conflict:
        "Состояние изменилось. Обновите данные перед повторным действием.",
      network: "Нет связи с сервером. Проверьте подключение.",
      server: "Сервер временно недоступен.",
      unknown: "Не удалось выполнить запрос.",
    }[error.kind];
  }
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить действие.";
}
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const loader = useRef(load);
  loader.current = load;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  }>({ key });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ key });
    loader.current().then(
      (data) => {
        if (active) setState({ key, data });
      },
      (error) => {
        if (active) setState({ key, error });
      },
    );
    return () => {
      active = false;
    };
  }, [key, revision]);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    reload,
  };
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const locked = useRef(false);
  async function run(
    action: () => Promise<unknown>,
    success = "Изменения сохранены",
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setError(false);
      setMessage(success);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        window.dispatchEvent(new Event("vitrina:session-expired"));
      setError(true);
      setMessage(errorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: message ? (
      <p
        role={error ? "alert" : "status"}
        className={error ? "student-error" : "student-success"}
      >
        {message}
      </p>
    ) : null,
  };
}
export function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
