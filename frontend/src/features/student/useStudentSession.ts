import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentGateway } from "./gateway";
import type { AuthSessionResponse } from "./contracts";
/** Read-only bridge until FE-C exposes its AuthProvider. No credentials or login state. */
export function useStudentSession(api: StudentGateway, demo: boolean) {
  const [state, setState] = useState<{
    data?: AuthSessionResponse;
    error?: unknown;
  }>({});
  const sequence = useRef(0);
  const refresh = useCallback(
    async (clear: boolean) => {
      const request = ++sequence.current;
      if (clear) setState({});
      try {
        const data = await api.session();
        if (sequence.current === request) setState({ data });
      } catch (error) {
        if (sequence.current === request) setState({ error });
      }
    },
    [api],
  );
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const reload = useCallback(() => {
    void refresh(true);
  }, [refresh]);
  useEffect(() => {
    reload();
    const verify = () => {
      void refresh(false);
    };
    if (!demo) {
      window.addEventListener("focus", verify);
      window.addEventListener("vitrina:session-expired", reload);
    }
    return () => {
      invalidate();
      window.removeEventListener("focus", verify);
      window.removeEventListener("vitrina:session-expired", reload);
    };
  }, [demo, refresh, reload, invalidate]);
  return { data: state.data, error: state.error, reload };
}
