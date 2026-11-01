import { safeUrl } from "../hooks";
import {
  categories,
  developmentLabels,
  interestLabels,
  type Draft,
} from "./models";
export function publicationErrors(d: Draft, publishing = true): string[] {
  const errors: string[] = [];
  if (publishing && !d.title.trim()) errors.push("Укажите название.");
  if (!categories.some(([id]) => id === d.category))
    errors.push("Выберите категорию.");
  if (d.title.length > 200 || d.description.length > 10000)
    errors.push("Сократите название или описание.");
  if (
    d.links.some(
      (x) => !x.label.trim() || !safeUrl(x.url) || x.url.length > 2048,
    )
  )
    errors.push("У каждой ссылки должны быть название и адрес http/https.");
  if (d.kind === "WORK") {
    if (publishing && !d.result.trim())
      errors.push("Опишите полученный результат.");
    if (publishing && !d.contribution.trim())
      errors.push("Опишите личный вклад.");
  } else {
    if (
      publishing &&
      (!d.summary.trim() ||
        !d.description.trim() ||
        !d.problem.trim() ||
        !d.goals.trim())
    )
      errors.push("Заполните краткое и подробное описание, проблему и цели.");
    if (!(d.developmentStatus in developmentLabels))
      errors.push("Выберите статус разработки.");
    if (d.interests.some((x) => !(x in interestLabels)))
      errors.push("Проверьте признаки поиска.");
    if (d.publicContactUrl && !safeUrl(d.publicContactUrl))
      errors.push("Публичный контакт должен быть ссылкой http/https.");
    if (d.vacancies.some((x) => !x.title.trim()))
      errors.push("Укажите название каждой открытой роли.");
  }
  return errors;
}
export function editable(status: string) {
  return ["DRAFT", "RETURNED", "REJECTED", "PUBLISHED"].includes(status);
}
