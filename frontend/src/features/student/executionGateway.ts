import { apiRequest } from "../../api/client";
import { mutate } from "./mutations";
import { downloadProtectedFile } from "./protectedFiles";
import type * as C from "./contracts";
export interface ExecutionGateway {
  workspace(id: string): Promise<C.CaseParticipantWorkspace>;
  submissionHistory(id: string): Promise<C.SubmissionVersionList>;
  submitVersion(
    id: string,
    body: C.SubmitVersionRequest,
    key: string,
  ): Promise<C.SubmissionVersion>;
  uploadSubmissionFile(
    caseId: string,
    checkpointId: string,
    applicationId: string,
    file: File,
  ): Promise<C.FileUploadResult>;
  fileMetadata(id: string): Promise<C.CaseFileMetadata>;
  downloadFile(id: string, name: string): Promise<void>;
  selectionResult(id: string): Promise<C.MyCheckpointSelectionResult>;
}
const get = <T>(path: string) =>
  apiRequest<T>(`/api/v1${path}`, { cache: "no-store" });
export const liveExecutionGateway: ExecutionGateway = {
  workspace: (id) => get(`/cases/${encodeURIComponent(id)}/workspace`),
  submissionHistory: (id) =>
    get(`/checkpoints/${encodeURIComponent(id)}/submissions/mine`),
  submitVersion: (id, body, key) =>
    mutate(
      `/checkpoints/${encodeURIComponent(id)}/submissions`,
      "POST",
      body,
      key,
    ),
  uploadSubmissionFile: (caseId, checkpointId, applicationId, file) => {
    const data = new FormData();
    for (const [k, v] of Object.entries({
      purpose: "SUBMISSION_ATTACHMENT",
      caseId,
      checkpointId,
      applicationId,
    }))
      data.append(k, v);
    data.append("file", file);
    return mutate("/files", "POST", data);
  },
  fileMetadata: (id) => get(`/files/${encodeURIComponent(id)}`),
  downloadFile: downloadProtectedFile,
  selectionResult: (id) =>
    get(`/checkpoints/${encodeURIComponent(id)}/selection-result/mine`),
};
