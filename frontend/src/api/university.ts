import { apiRequest } from './client';
import {
  demoCreateCompany, demoGetCompany, demoInviteRepresentative, demoListCompanies,
  demoListInvitations, demoReferenceData, isUniversityDemoEnabled,
} from '../features/university/demo';

export interface Company {
  id: string;
  name: string;
  description: string;
  website?: string;
  logoFileId?: string;
  directionIds: string[];
  contactEmail: string;
  createdAt: string;
}

export interface CompanyListResponse {
  items: Company[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateCompanyPayload {
  name: string;
  description: string;
  contactEmail: string;
  website?: string;
  logoFileId?: string;
  directionIds: string[];
}

export type InvitationRole = 'OWNER' | 'MEMBER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface CompanyInvitation {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationListResponse {
  items: CompanyInvitation[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ReferenceData {
  directions: { id: string; name: string }[];
  technologies: { id: string; name: string }[];
  competencies: { id: string; name: string }[];
  portfolioCategories: { id: string; name: string }[];
  institutes: { id: string; name: string }[];
}

export function listCompanies({ page = 1, pageSize = 20, search = '' }: {
  page?: number; pageSize?: number; search?: string;
} = {}) {
  if (isUniversityDemoEnabled()) return Promise.resolve(demoListCompanies({ page, pageSize, search }));
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) query.set('search', search.trim());
  return apiRequest<CompanyListResponse>(`/api/v1/companies?${query}`);
}

export function getCompany(companyId: string) {
  if (isUniversityDemoEnabled()) return demoGetCompany(companyId);
  return apiRequest<Company>(`/api/v1/companies/${encodeURIComponent(companyId)}`);
}

export function createCompany(payload: CreateCompanyPayload) {
  if (isUniversityDemoEnabled()) return demoCreateCompany(payload);
  return apiRequest<Company>('/api/v1/companies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listCompanyInvitations(companyId: string, page = 1, pageSize = 100) {
  if (isUniversityDemoEnabled()) return Promise.resolve(demoListInvitations(companyId, page, pageSize));
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiRequest<InvitationListResponse>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/invitations?${query}`,
  );
}

export function inviteCompanyRepresentative(companyId: string, email: string, role: InvitationRole) {
  if (isUniversityDemoEnabled()) return demoInviteRepresentative(companyId, email, role);
  return apiRequest<CompanyInvitation>(`/api/v1/companies/${encodeURIComponent(companyId)}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function getReferenceData() {
  if (isUniversityDemoEnabled()) return Promise.resolve(demoReferenceData());
  return apiRequest<ReferenceData>('/api/v1/reference-data');
}
