/** Provisional FB-25–FB-30 UI models. No approved HTTP contract yet. */
import type {
  Development,
  Publication,
  PublicProject,
} from "../publications/models";
export type Member = { userId: string; nickname: string; role: string };
export type ProjectApplication = {
  id: string;
  projectId: string;
  userId: string;
  nickname: string;
  roleId: string;
  roleTitle: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  version: number;
  createdAt: string;
};
export type Curator = { nickname: string; assignedAt: string };
export type ManagedProject = {
  project: Publication;
  version: number;
  members: Member[];
  applications: ProjectApplication[];
  curator: Curator | null;
  allowedActions: ("decide" | "remove")[];
};
export type ApplicationContext = {
  project: PublicProject;
  relation: "AUTHOR" | "MEMBER" | "CANDIDATE";
  application?: ProjectApplication;
};
export type Notice = {
  id: string;
  userId: string;
  kind: "APPLICATION" | "CURATOR" | "INVITATION";
  destination: "TEAM" | "APPLICATION" | "INVITATIONS";
  title: string;
  projectId?: string;
  read: boolean;
  version: number;
  createdAt: string;
};
export type Favorite = { caseId: string; title: string; companyName: string };
export interface ProjectManagementGateway {
  projects(): Promise<Publication[]>;
  manage(id: string): Promise<ManagedProject>;
  changeDevelopment(
    id: string,
    value: Development,
    expectedVersion: number,
  ): Promise<Publication>;
  decide(
    projectId: string,
    applicationId: string,
    decision: "ACCEPTED" | "REJECTED",
    expectedVersion: number,
  ): Promise<void>;
  remove(
    projectId: string,
    userId: string,
    expectedVersion: number,
  ): Promise<void>;
  applicationContext(projectId: string): Promise<ApplicationContext>;
  apply(
    projectId: string,
    roleId: string,
    message: string,
  ): Promise<ProjectApplication>;
  withdraw(
    projectId: string,
    applicationId: string,
    expectedVersion: number,
  ): Promise<void>;
  favorites(): Promise<Favorite[]>;
  setFavorite(caseId: string, saved: boolean): Promise<void>;
  notices(): Promise<Notice[]>;
  markRead(id: string, expectedVersion: number): Promise<void>;
}
