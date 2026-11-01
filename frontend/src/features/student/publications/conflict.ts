import type { Draft } from "./models";
export const fieldLabels: Record<string, string> = {
  title: "Название",
  category: "Категория",
  description: "Описание",
  technologyIds: "Технологии",
  directionId: "Направление",
  startDate: "Дата начала",
  links: "Ссылки",
  media: "Материалы",
  result: "Результат",
  contribution: "Личный вклад",
  coauthors: "Соавторы",
  summary: "Краткое описание",
  problem: "Проблема",
  goals: "Цели",
  developmentStatus: "Статус разработки",
  publicContactUrl: "Публичный контакт",
  interests: "Интересы",
  vacancies: "Открытые роли",
};
export function comparePublication(base: Draft, local: Draft, server: Draft) {
  if (base.kind !== server.kind || local.kind !== base.kind)
    throw new Error("Тип публикации изменился.");
  const before = Object.fromEntries(Object.entries(base)),
    mine = Object.fromEntries(Object.entries(local)),
    remote = Object.fromEntries(Object.entries(server));
  const changed = Object.keys(mine).filter(
    (k) => JSON.stringify(mine[k]) !== JSON.stringify(before[k]),
  );
  const conflicts = changed.filter(
    (k) =>
      JSON.stringify(remote[k]) !== JSON.stringify(before[k]) &&
      JSON.stringify(remote[k]) !== JSON.stringify(mine[k]),
  );
  return {
    conflicts: conflicts.map((key) => ({
      key,
      label: fieldLabels[key] ?? key,
      mine: JSON.stringify(mine[key]),
      server: JSON.stringify(remote[key]),
    })),
    merged: {
      ...server,
      ...Object.fromEntries(changed.map((k) => [k, mine[k]])),
    } as Draft,
  };
}
