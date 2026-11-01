import { executionBlock } from "./executionRules";
import { ApiError } from "../../api/client";
import type * as C from "./contracts";
import type { Day2Gateway, StudentGateway } from "./gateway";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const executionIds = {
  case: uid(10),
  application: uid(20),
  stage: uid(61),
  checkpoint: uid(62),
  selection: uid(63),
  file: uid(64),
  team: uid(30),
};
/** Provisional UI-only fields absent from OpenAPI; never added to live DTOs. */
export const executionDemoExtras = {
  acceptedTypes: ["application/pdf", "image/png", "image/jpeg"],
  maxBytes: 5 * 1024 * 1024,
  comments: [
    {
      author: "Представитель компании",
      text: "Прототип принят. Добавьте описание проверки результата.",
      at: "2026-10-30T10:00:00Z",
    },
  ],
  regularResult: "Проверено компанией: требуется доработка описания.",
};
export function withExecutionDemo(base: Day2Gateway): StudentGateway {
  const clone = <T>(x: T): T => structuredClone(x),
    now = () => new Date().toISOString(),
    me = uid(1),
    ids = executionIds;
  const app: C.CaseApplication = {
    id: ids.application,
    caseId: ids.case,
    format: "TEAM",
    teamId: ids.team,
    status: "ADMITTED",
    version: 1,
    participantUserIds: [me],
    createdAt: now(),
    updatedAt: now(),
    allowedActions: [],
  };
  const team: C.CaseTeam = {
    id: ids.team,
    caseId: ids.case,
    name: "Демо-команда активного кейса",
    captainUserId: me,
    members: [
      {
        userId: me,
        displayName: "student_demo",
        isCaptain: true,
        joinedAt: now(),
      },
    ],
    pendingInvitations: [],
    membershipLocked: true,
    createdAt: now(),
  };
  const workspace: C.CaseParticipantWorkspace = {
    caseId: ids.case,
    applicationId: app.id,
    status: "EXECUTING",
    myParticipationStatus: "ACTIVE",
    ndaRequired: true,
    ndaAcceptedForApplication: true,
    allowedActions: [],
    stages: [
      {
        id: ids.stage,
        sequence: 1,
        title: "Разработка прототипа",
        description:
          "Подготовьте прототип, опишите архитектуру и результаты проверки.",
        materials: [
          {
            fileId: ids.file,
            displayName: "Требования к прототипу.pdf",
            sizeBytes: 1200,
            contentType: "application/pdf",
          },
        ],
        checkpoints: [
          {
            id: ids.checkpoint,
            stageId: ids.stage,
            title: "Прототип и пояснение",
            kind: "REGULAR",
            deadline: new Date(Date.now() - 86400000).toISOString(),
            intakeStatus: "OPEN",
            canSubmit: true,
            mySelectionOutcome: "NOT_APPLICABLE",
          },
          {
            id: ids.selection,
            stageId: ids.stage,
            title: "Промежуточный отбор",
            kind: "SELECTION",
            deadline: now(),
            intakeStatus: "SELECTION_CLOSED",
            canSubmit: false,
            mySelectionOutcome: "PASSED",
          },
        ],
      },
    ],
  };
  const files = new Map<string, C.CaseFileMetadata>([
    [
      ids.file,
      {
        id: ids.file,
        displayName: "Требования к прототипу.pdf",
        contentType: "application/pdf",
        sizeBytes: 1200,
        purpose: "STAGE_MATERIAL",
        status: "READY",
        createdAt: now(),
      },
    ],
  ]);
  const histories = new Map<string, C.SubmissionVersion[]>([
    [
      ids.checkpoint,
      [
        {
          id: uid(66),
          checkpointId: ids.checkpoint,
          applicationId: app.id,
          version: 1,
          submittedByUserId: me,
          submittedAt: now(),
          isLate: false,
          description: "Первый прототип сервиса",
          links: [],
          attachments: [],
        },
      ],
    ],
  ]);
  const outcomes = new Map<
    string,
    { serialized: string; version: C.SubmissionVersion }
  >();
  return {
    ...base,
    application: async (id) =>
      id === app.id ? clone(app) : base.application(id),
    team: async (id) => (id === team.id ? clone(team) : base.team(id)),
    caseDetails: async (id) =>
      id === ids.case
        ? {
            id,
            companyId: ids.stage,
            companyName: "Демо-компания",
            title: "Сервис для студенческих команд",
            description: "Учебный активный кейс",
            status: workspace.status,
            participationFormat: "TEAM",
            admissionMode: "SELECTIVE",
            registrationDeadline: now(),
            directionIds: [],
            technologyIds: [],
          }
        : base.caseDetails(id),
    workspace: async (id) => {
      if (id !== ids.case) throw new ApiError("notFound", 404);
      return clone(workspace);
    },
    submissionHistory: async (id) => {
      if (!workspace.stages.some((s) => s.checkpoints.some((c) => c.id === id)))
        throw new ApiError("forbidden", 403);
      const items = histories.get(id) ?? [];
      return clone({ items, latestVersion: items.at(-1)?.version ?? 0 });
    },
    submitVersion: async (id, body, key) => {
      const serialized = JSON.stringify([id, body]),
        previous = outcomes.get(key);
      if (previous) {
        if (previous.serialized !== serialized)
          throw new ApiError("conflict", 409);
        return clone(previous.version);
      }
      const point = workspace.stages
        .flatMap((s) => s.checkpoints)
        .find((c) => c.id === id);
      if (
        !point ||
        !point.canSubmit ||
        point.intakeStatus !== "OPEN" ||
        workspace.myParticipationStatus !== "ACTIVE" ||
        workspace.status !== "EXECUTING"
      )
        throw new ApiError("forbidden", 403);
      const currentApp = await base.application(app.id);
      const currentTeam = currentApp.teamId
        ? await base.team(currentApp.teamId)
        : undefined;
      const actor = (await base.session()).user.id;
      if (executionBlock(workspace, currentApp, currentTeam, actor, point))
        throw new ApiError("forbidden", 403);
      const items = histories.get(id) ?? [];
      if (
        body.applicationId !== app.id ||
        body.expectedLastVersion !== (items.at(-1)?.version ?? 0)
      )
        throw new ApiError("conflict", 409);
      const attachments = (body.fileIds ?? []).map((fileId) => {
        const f = files.get(fileId);
        if (!f || f.status !== "READY" || f.purpose !== "SUBMISSION_ATTACHMENT")
          throw new ApiError("forbidden", 403);
        return f;
      });
      const version: C.SubmissionVersion = {
        id: crypto.randomUUID(),
        checkpointId: id,
        applicationId: app.id,
        version: body.expectedLastVersion + 1,
        submittedByUserId: me,
        submittedAt: now(),
        isLate: Date.now() > Date.parse(point.deadline),
        description: body.description,
        links: body.links ?? [],
        attachments,
      };
      items.push(version);
      histories.set(id, items);
      outcomes.set(key, { serialized, version });
      return clone(version);
    },
    uploadSubmissionFile: async (caseId, checkpointId, applicationId, file) => {
      if (
        caseId !== ids.case ||
        checkpointId !== ids.checkpoint ||
        applicationId !== app.id
      )
        throw new ApiError("forbidden", 403);
      if (
        !executionDemoExtras.acceptedTypes.includes(file.type) ||
        file.size > executionDemoExtras.maxBytes
      )
        throw new Error("В демопримере допустимы PDF, PNG, JPEG до 5 МБ.");
      const fileId = crypto.randomUUID();
      files.set(fileId, {
        id: fileId,
        displayName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        purpose: "SUBMISSION_ATTACHMENT",
        status: "READY",
        createdAt: now(),
      });
      return {
        fileId,
        status: "READY",
        createdAt: now(),
        stagedUntil: new Date(Date.now() + 3600000).toISOString(),
      };
    },
    fileMetadata: async (id) => {
      const f = files.get(id);
      if (!f) throw new ApiError("notFound", 404);
      return clone(f);
    },
    downloadFile: async () => {
      throw new Error("В деморежиме скачивание приватного файла недоступно.");
    },
    selectionResult: async (id) => {
      if (id !== ids.selection) throw new ApiError("notFound", 404);
      return {
        checkpointId: id,
        teamId: team.id,
        outcome: "PASSED",
        decidedAt: now(),
      };
    },
  };
}
