import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { errorMessage } from "./hooks";
import type { StudentGateway } from "./gateway";
import type { CaseApplication } from "./contracts";
export type DraftFailure = {
  kind: "retry" | "conflict" | "access";
  message: string;
};
/** One serialized PATCH at a time. Never replace local input after a failed request. */
export function useApplicationDraft(
  initial: CaseApplication,
  api: StudentGateway,
  userId: string,
  captainId?: string,
) {
  const [app, setAppState] = useState(initial),
    [letter, setLetterState] = useState(initial.coverLetter ?? ""),
    [saved, setSaved] = useState(initial.coverLetter ?? ""),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState<DraftFailure>();
  const current = useRef(initial),
    latestLetter = useRef(initial.coverLetter ?? ""),
    inFlight = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const owner =
    app.format === "SOLO"
      ? app.soloApplicantUserId === userId
      : captainId === userId;
  const editable =
    app.status === "DRAFT" && app.allowedActions.includes("edit") && owner;
  const setApp = useCallback((next: CaseApplication) => {
    current.current = next;
    setAppState(next);
  }, []);
  const setLetter = useCallback((next: string) => {
    latestLetter.current = next;
    setLetterState(next);
  }, []);
  const save = useCallback(async () => {
    if (inFlight.current) return;
    const base = current.current;
    if (
      base.status !== "DRAFT" ||
      !base.allowedActions.includes("edit") ||
      !(base.format === "SOLO"
        ? base.soloApplicantUserId === userId
        : captainId === userId)
    )
      return;
    inFlight.current = true;
    setSaving(true);
    const snapshot = latestLetter.current;
    try {
      const next = await api.saveApplication(base.id, {
        expectedVersion: base.version,
        coverLetter: snapshot,
      });
      if (!mounted.current) return;
      if (next.id !== base.id || next.caseId !== base.caseId)
        throw new Error("Ответ относится к другой заявке.");
      setApp(next);
      setSaved(next.coverLetter ?? snapshot);
      setFailure(undefined);
      if (latestLetter.current === snapshot)
        setLetter(next.coverLetter ?? snapshot);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError && error.status === 401)
        window.dispatchEvent(new Event("vitrina:session-expired"));
      setFailure({
        kind:
          error instanceof ApiError && error.status === 409
            ? "conflict"
            : error instanceof ApiError &&
                (error.status === 403 || error.status === 401)
              ? "access"
              : "retry",
        message: errorMessage(error),
      });
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [api, userId, captainId, setApp, setLetter]);
  useEffect(() => {
    if (!editable || letter === saved || saving || failure) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [editable, letter, saved, saving, failure, save]);
  async function retry() {
    if (failure?.kind !== "retry" || inFlight.current) return;
    await save();
  }
  async function compare() {
    const fresh = await api.application(current.current.id);
    if (
      fresh.id !== current.current.id ||
      fresh.caseId !== current.current.caseId
    )
      throw new Error("Ответ относится к другой заявке.");
    const captain =
      fresh.format === "TEAM" && fresh.teamId
        ? (await api.team(fresh.teamId)).captainUserId
        : undefined;
    const mayEdit =
      fresh.format === "SOLO"
        ? fresh.soloApplicantUserId === userId
        : captain === userId;
    if (
      !mayEdit ||
      fresh.status !== "DRAFT" ||
      !fresh.allowedActions.includes("edit")
    ) {
      setFailure({
        kind: "access",
        message:
          "Редактирование больше не разрешено. Ваш текст сохранён в форме и доступен для копирования.",
      });
      return undefined;
    }
    return fresh;
  }
  async function resolve(fresh: CaseApplication, choice: "mine" | "server") {
    if (inFlight.current) return;
    setApp(fresh);
    setSaved(fresh.coverLetter ?? "");
    if (choice === "server") {
      setLetter(fresh.coverLetter ?? "");
      setFailure(undefined);
    } else await save();
  }
  return {
    app,
    setApp,
    letter,
    setLetter,
    saved,
    saving,
    failure,
    retry,
    compare,
    resolve,
    current,
    owner,
    editable,
    dirty: letter !== saved || saving,
  };
}
