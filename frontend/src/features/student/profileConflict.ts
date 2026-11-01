import type * as C from "./contracts";
export const profileFields = [
  "fullName",
  "nickname",
  "instituteId",
  "course",
  "studyGroup",
  "description",
  "publicSummary",
  "publicLinks",
  "achievements",
  "skillIds",
  "technologyIds",
] as const;
export type ProfileField = (typeof profileFields)[number];
export const profileFieldLabels: Record<ProfileField, string> = {
  fullName: "ФИО",
  nickname: "Никнейм",
  instituteId: "Институт",
  course: "Курс",
  studyGroup: "Группа",
  description: "Описание",
  publicSummary: "Публичное описание",
  publicLinks: "Публичные ссылки",
  achievements: "Достижения",
  skillIds: "Навыки",
  technologyIds: "Технологии",
};
const equal = (
  field: ProfileField,
  a: C.StudentProfilePrivate,
  b: C.StudentProfilePrivate,
) =>
  JSON.stringify(field === "instituteId" ? (a[field] ?? null) : a[field]) ===
  JSON.stringify(field === "instituteId" ? (b[field] ?? null) : b[field]);
export const changedProfileFields = (
  base: C.StudentProfilePrivate,
  draft: C.StudentProfilePrivate,
) => profileFields.filter((field) => !equal(field, base, draft));
export function conflictingProfileFields(
  base: C.StudentProfilePrivate,
  draft: C.StudentProfilePrivate,
  server: C.StudentProfilePrivate,
) {
  return changedProfileFields(base, draft).filter(
    (field) => !equal(field, base, server) && !equal(field, draft, server),
  );
}
export function profilePatch(
  base: C.StudentProfilePrivate,
  draft: C.StudentProfilePrivate,
): C.StudentProfileUpdateRequest {
  const entries = changedProfileFields(base, draft).map((field) => [
    field,
    field === "instituteId"
      ? (draft[field] ?? null)
      : field === "nickname" || field === "fullName"
        ? draft[field].trim()
        : draft[field],
  ]);
  return { ...Object.fromEntries(entries), expectedVersion: base.version };
}
/** Three-way merge: server-only changes survive; overlapping edits require a choice. */
export function resolveProfileConflict(
  base: C.StudentProfilePrivate,
  draft: C.StudentProfilePrivate,
  server: C.StudentProfilePrivate,
  choices: Partial<Record<ProfileField, "mine" | "server">>,
): C.StudentProfilePrivate {
  const conflicts = conflictingProfileFields(base, draft, server);
  if (conflicts.some((field) => !choices[field]))
    throw new Error("Выберите значение для каждого конфликтующего поля.");
  const local = changedProfileFields(base, draft).filter(
    (field) => !conflicts.includes(field) || choices[field] === "mine",
  );
  return {
    ...server,
    ...Object.fromEntries(local.map((field) => [field, draft[field]])),
  };
}
