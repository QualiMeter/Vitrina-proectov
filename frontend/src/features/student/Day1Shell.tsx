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
  const [publications] = useState(createPublicationDemo);
  return (
    <DemoGatewayContext.Provider value={api}>
      <PublicationContext.Provider value={publications}>
        <Outlet />
      </PublicationContext.Provider>
    </DemoGatewayContext.Provider>
  );
}
