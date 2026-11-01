const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const executionIds = {
  case: uid(10),
  application: uid(20),
  team: uid(30),
  stage: uid(61),
  checkpoint: uid(62),
  selection: uid(63),
  file: uid(64),
};
/** Independent mock server fixtures; no imports from production modules. */
export function createExecutionFixture() {
  const id = executionIds,
    me = uid(1),
    now = () => new Date().toISOString();
  const workspace = {
    caseId: id.case,
    applicationId: id.application,
    status: "EXECUTING",
    myParticipationStatus: "ACTIVE",
    ndaRequired: true,
    ndaAcceptedForApplication: true,
    allowedActions: [],
    stages: [
      {
        id: id.stage,
        sequence: 1,
        title: "Разработка прототипа",
        description: "Закрытая инструкция",
        materials: [],
        checkpoints: [
          {
            id: id.checkpoint,
            stageId: id.stage,
            title: "Прототип и пояснение",
            kind: "REGULAR",
            deadline: "2026-01-01T00:00:00Z",
            intakeStatus: "OPEN",
            canSubmit: true,
            mySelectionOutcome: "NOT_APPLICABLE",
          },
          {
            id: id.selection,
            stageId: id.stage,
            title: "Отбор",
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
  const app = {
    id: id.application,
    caseId: id.case,
    format: "TEAM",
    teamId: id.team,
    status: "ADMITTED",
    version: 1,
    participantUserIds: [me],
    createdAt: now(),
    updatedAt: now(),
    allowedActions: [],
  };
  const team = {
    id: id.team,
    caseId: id.case,
    name: "Демо-команда",
    captainUserId: me,
    members: [
      { userId: me, displayName: "Студент", isCaptain: true, joinedAt: now() },
    ],
    pendingInvitations: [],
    membershipLocked: true,
    createdAt: now(),
  };
  const versions = [
    {
      id: uid(66),
      checkpointId: id.checkpoint,
      applicationId: app.id,
      version: 1,
      submittedByUserId: me,
      submittedAt: now(),
      isLate: false,
      description: "Первый результат",
      links: [],
      attachments: [],
    },
  ];
  const outcomes = new Map<string, (typeof versions)[number]>();
  return {
    workspace: async () => workspace,
    application: async () => app,
    team: async () => team,
    session: async () => ({
      user: {
        id: me,
        email: "demo@example.invalid",
        fullName: "Студент",
        globalRoles: ["STUDENT"],
        availableAreas: ["student"],
        permissions: [],
        companyMemberships: [],
      },
      session: { expiresAt: "2099-01-01T00:00:00Z" },
    }),
    caseDetails: async () => ({
      id: id.case,
      companyId: uid(2),
      companyName: "Компания",
      title: "Сервис для студенческих команд",
      description: "Кейс",
      status: workspace.status,
      participationFormat: "TEAM",
      admissionMode: "SELECTIVE",
      registrationDeadline: now(),
      directionIds: [],
      technologyIds: [],
    }),
    submissionHistory: async (point: string) => ({
      items: point === id.checkpoint ? [...versions] : [],
      latestVersion: point === id.checkpoint ? versions.at(-1)!.version : 0,
    }),
    selectionResult: async () => ({
      checkpointId: id.selection,
      teamId: id.team,
      outcome: "PASSED",
      decidedAt: now(),
    }),
    submitVersion: async (
      point: string,
      body: {
        expectedLastVersion: number;
        applicationId: string;
        description?: string;
      },
      key: string,
    ) => {
      if (outcomes.has(key)) return outcomes.get(key)!;
      if (body.expectedLastVersion !== versions.at(-1)!.version)
        throw new Error("Unexpected stale mock version");
      const version = {
        id: crypto.randomUUID(),
        checkpointId: point,
        applicationId: app.id,
        version: versions.length + 1,
        submittedByUserId: me,
        submittedAt: now(),
        isLate: true,
        description: body.description ?? "",
        links: [],
        attachments: [],
      };
      versions.push(version);
      outcomes.set(key, version);
      return version;
    },
  };
}
