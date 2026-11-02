import type { CaseStatus } from './types';

export const caseStatusLabels: Record<CaseStatus, string> = {
  DRAFT: 'Черновик',
  MODERATION: 'На модерации',
  REVISION: 'Нужны изменения',
  REJECTED: 'Отклонён',
  APPROVED: 'Опубликован',
  REGISTRATION_OPEN: 'Набор открыт',
  REGISTRATION_CLOSED: 'Набор закрыт',
  EXECUTING: 'В работе',
  FINAL_CLOSED: 'Работы завершены',
  EVALUATING: 'Подведение итогов',
  COMPLETED: 'Завершён',
  CANCELED: 'Отменён'
};
