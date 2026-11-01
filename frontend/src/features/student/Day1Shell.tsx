import { ProjectManagementContext } from "./projects/context";
import {
  createProjectManagementState,
  createProjectManagementDemo,
} from "./projects/demo";
import { PublicationContext } from "./publications/context";
import { createPublicationDemo } from "./publications/demo";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { DemoGatewayContext } from "./demoContext";
import { createDemoGateway } from "./demo";
import { EmptyState } from "../../components/feedback/States";

export function LaterSection() {
  return (
    <EmptyState
      title="Раздел пока недоступен"
      description="Он появится в следующем обновлении кабинета."
    />
  );
}
export function DemoProvider() {
  const [api] = useState(createDemoGateway);
  const [domain] = useState(() => {
    const state = createProjectManagementState();
    const publications = createPublicationDemo(undefined, (id) =>
      state.teams[id]?.members.map((m) => ({
        nickname: m.nickname,
        role: m.role,
        competencies: [],
      })),
    );
    return {
      publications,
      management: createProjectManagementDemo(publications, undefined, state),
    };
  });
  const { publications, management } = domain;
  return (
    <DemoGatewayContext.Provider value={api}>
      <PublicationContext.Provider value={publications}>
        <ProjectManagementContext.Provider value={management}>
          <Outlet />
        </ProjectManagementContext.Provider>
      </PublicationContext.Provider>
    </DemoGatewayContext.Provider>
  );
}
