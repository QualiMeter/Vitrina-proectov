import {
  PortfolioPage,
  MyProjectList,
  PublicPortfolioPage,
} from "./publications/PortfolioPage";
import {
  ProjectsCatalog,
  ProjectDetails,
} from "./publications/ProjectsCatalog";
import { PublicationEditorPage } from "./publications/PublicationEditor";
import { WorkspacePage } from "./WorkspacePage";
import { StudentRedirect } from "./StudentRedirect";
import { TeamsPage, MyTeamsPage } from "./TeamsPage";
import { InvitationsPage } from "./InvitationsPage";
import { TeamPage } from "./TeamPage";
import { ApplicationPage } from "./ApplicationPage";
import type { RouteObject } from "react-router-dom";
import { StudentRoot } from "./StudentRoot";
import {
  DashboardPage,
  ParticipationsPage,
  ProfilePage,
  PublicProfilePage,
} from "./ProfilePages";
import { DemoProvider } from "./Day1Shell";
const privatePages: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: "profile", element: <ProfilePage /> },
  { path: "participations", element: <ParticipationsPage /> },
  { path: "invitations", element: <StudentRedirect to="teams/invitations" /> },
  {
    path: "teams",
    element: <TeamsPage />,
    children: [
      { index: true, element: <MyTeamsPage /> },
      { path: "invitations", element: <InvitationsPage embedded /> },
    ],
  },
  { path: "teams/:teamId", element: <TeamPage /> },
  { path: "cases/:caseId/apply", element: <ApplicationPage /> },
  {
    path: "drafts",
    element: <StudentRedirect to="participations?filter=drafts" />,
  },
  { path: "cases/:caseId/workspace", element: <WorkspacePage /> },
  { path: "portfolio", element: <PortfolioPage /> },
  { path: "portfolio/new", element: <PublicationEditorPage kind="WORK" /> },
  {
    path: "portfolio/works/:publicationId/edit",
    element: <PublicationEditorPage kind="WORK" />,
  },
  { path: "projects", element: <MyProjectList /> },
  { path: "projects/new", element: <PublicationEditorPage kind="PROJECT" /> },
  {
    path: "projects/:publicationId/edit",
    element: <PublicationEditorPage kind="PROJECT" />,
  },
];
export const studentRoutes: RouteObject[] = [
  { path: "/student", element: <StudentRoot />, children: privatePages },
  { path: "/students/:id", element: <PublicProfilePage /> },
  { path: "/students/:id/portfolio", element: <PublicPortfolioPage /> },
  { path: "/student-projects", element: <ProjectsCatalog /> },
  { path: "/student-projects/:projectId", element: <ProjectDetails /> },
  {
    path: "/demo",
    element: <DemoProvider />,
    children: [
      {
        path: "student",
        element: <StudentRoot demo />,
        children: privatePages,
      },
      { path: "students/:id", element: <PublicProfilePage demo /> },
      { path: "students/:id/portfolio", element: <PublicPortfolioPage demo /> },
      { path: "student-projects", element: <ProjectsCatalog demo /> },
      { path: "student-projects/:projectId", element: <ProjectDetails demo /> },
    ],
  },
];
