import type * as C from "./contracts";
export function submissionBlocks(
  details: C.CasePublicDetails,
  profile: C.StudentProfilePrivate,
  team?: C.CaseTeam,
): string[] {
  const reasons: string[] = [];
  if (details.status !== "REGISTRATION_OPEN")
    reasons.push("Набор в кейс закрыт.");
  if (new Date(details.registrationDeadline).getTime() <= Date.now())
    reasons.push("Срок подачи заявки истёк.");
  if (
    (details.minCourse !== undefined || details.maxCourse !== undefined) &&
    profile.course === undefined
  )
    reasons.push("Укажите курс в профиле.");
  if (
    profile.course !== undefined &&
    ((details.minCourse !== undefined && profile.course < details.minCourse) ||
      (details.maxCourse !== undefined && profile.course > details.maxCourse))
  )
    reasons.push("Ваш курс не соответствует условиям кейса.");
  if (team) {
    if (
      team.members.length < (details.minTeamSize ?? 1) ||
      team.members.length > (details.maxTeamSize ?? Infinity)
    )
      reasons.push("Размер команды не соответствует условиям кейса.");
    if (team.pendingInvitations.some((x) => x.status === "PENDING"))
      reasons.push("Дождитесь подтверждения всех приглашений или отзовите их.");
  }
  return reasons;
}

export function appendPortfolioLink(letter: string, input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Укажите корректный адрес портфолио.");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Для портфолио допустимы только http и https.");
  const result = [letter.trimEnd(), `Портфолио: ${url.href}`]
    .filter(Boolean)
    .join("\n");
  if (result.length > 5000)
    throw new Error(
      "Письмо вместе со ссылками не должно превышать 5000 символов.",
    );
  return result;
}
