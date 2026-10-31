import { StudentRedirect } from "./StudentRedirect";
import { TeamsPage, MyTeamsPage } from "./TeamsPage";
import { InvitationsPage } from "./InvitationsPage";
import { TeamPage } from "./TeamPage";
import { ApplicationPage } from "./ApplicationPage";
import type { RouteObject } from "react-router-dom";
import { StudentRoot } from "./shared";
import {
  DashboardPage,
  ParticipationsPage,
  ProfilePage,
  PublicProfilePage,
} from "./ProfilePages";
import { DemoProvider, LaterSection } from "./Day1Shell";
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
  // Navigation sections required by FB-01; their business functions belong to later days.
  ...["portfolio", "projects", "cases/:caseId/workspace"].map((path) => ({
    path,
    element: <LaterSection />,
  })),
];
export const studentRoutes: RouteObject[] = [
  { path: "/student", element: <StudentRoot />, children: privatePages },
  { path: "/students/:id", element: <PublicProfilePage /> },
  ...[
    "/students/:id/portfolio",
    "/student-projects",
    "/student-projects/:projectId",
  ].map((path) => ({ path, element: <LaterSection /> })),
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
      ...[
        "students/:id/portfolio",
        "student-projects",
        "student-projects/:projectId",
      ].map((path) => ({ path, element: <LaterSection /> })),
    ],
  },
];
