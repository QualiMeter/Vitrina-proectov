import type * as C from "./contracts";
export function executionBlock(
  w: C.CaseParticipantWorkspace,
  a: C.CaseApplication,
  t: C.CaseTeam | undefined,
  userId: string,
  p: C.WorkspaceCheckpoint,
): string | undefined {
  if (a.id !== w.applicationId || a.caseId !== w.caseId)
    return "Заявка не соответствует рабочей области.";
  if (a.status !== "ADMITTED") return "Заявка не допущена к выполнению.";
  if (!a.participantUserIds.includes(userId))
    return "Вы не входите в состав этой заявки.";
  if (w.myParticipationStatus !== "ACTIVE")
    return "Участие завершено. Доступна только разрешённая история.";
  if (w.status !== "EXECUTING")
    return "Отправка доступна только во время выполнения кейса.";
  if (w.ndaRequired && !w.ndaAcceptedForApplication)
    return "Для заявки не подтверждено необходимое NDA.";
  if (a.format === "TEAM" && !t)
    return "Не удалось подтвердить роль в команде. Отправка недоступна.";
  if (
    a.format === "TEAM" &&
    (!t || t.id !== a.teamId || t.captainUserId !== userId)
  )
    return "Отправлять результат может только капитан команды.";
  if (a.format === "SOLO" && a.soloApplicantUserId !== userId)
    return "Отправлять результат может только автор SOLO-заявки.";
  if (p.intakeStatus !== "OPEN") return "Приём результатов закрыт вручную.";
  if (!p.canSubmit)
    return "Сервер не разрешил отправку в эту контрольную точку.";
  return undefined;
}
export const checkpointKind: Record<C.CheckpointKind, string> = {
  REGULAR: "Контрольная точка",
  SELECTION: "Отбор",
  FINAL: "Финальный результат",
};
