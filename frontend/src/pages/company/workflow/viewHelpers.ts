import { WorkflowError } from './repository';
import type { CaseApplication } from './contracts.generated';

export const applicationStatuses: Record<CaseApplication['status'], string> = {
  DRAFT: 'Черновик', SUBMITTED: 'На рассмотрении', ADMITTED: 'Допущена', REJECTED: 'Отклонена', WITHDRAWN: 'Отозвана'
};
export function localDate(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function isoDate(value: string) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new WorkflowError('validation', 'Укажите дату и время.');
  return date.toISOString();
}
