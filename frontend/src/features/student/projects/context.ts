import { createContext, useContext } from "react";
import type { ProjectManagementGateway } from "./models";
import { PublicationUnavailable } from "../publications/context";
export const ProjectManagementContext =
  createContext<ProjectManagementGateway | null>(null);
const unavailable = async (): Promise<never> => {
  throw new PublicationUnavailable();
};
export const blockedProjectManagementGateway: ProjectManagementGateway = {
  projects: unavailable,
  manage: unavailable,
  changeDevelopment: unavailable,
  decide: unavailable,
  remove: unavailable,
  applicationContext: unavailable,
  apply: unavailable,
  withdraw: unavailable,
  favorites: unavailable,
  setFavorite: unavailable,
  notices: unavailable,
  markRead: unavailable,
};
export function useProjectManagement(demo: boolean) {
  const api = useContext(ProjectManagementContext);
  if (!demo) return blockedProjectManagementGateway;
  if (!api) throw new Error("Демонстрационный источник не подключён.");
  return api;
}
