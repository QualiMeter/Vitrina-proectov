import type { ExecutionGateway } from "./executionGateway";
export async function readOwnHistory(
  api: ExecutionGateway,
  checkpointId: string,
  applicationId: string,
) {
  const history = await api.submissionHistory(checkpointId);
  if (
    history.items.some(
      (v) =>
        v.checkpointId !== checkpointId || v.applicationId !== applicationId,
    ) ||
    history.latestVersion !==
      Math.max(0, ...history.items.map((v) => v.version))
  )
    throw new Error("История не соответствует вашей заявке или версии сдачи.");
  return history;
}
