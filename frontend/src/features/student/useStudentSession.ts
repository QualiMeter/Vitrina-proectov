import { useCallback, useEffect, useRef, useState } from "react";
import type { StudentGateway } from "./gateway";
import type { AuthSessionResponse } from "./contracts";
/** Demo sessions stay isolated; live sessions are owned by the shared AuthProvider. */
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
    if (demo) reload();
    return () => {
      invalidate();
    };
  }, [demo, refresh, reload, invalidate]);
  return { data: state.data, error: state.error, reload };
}
