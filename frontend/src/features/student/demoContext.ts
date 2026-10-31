import { createContext } from "react";
import type { StudentGateway } from "./gateway";
export const DemoGatewayContext = createContext<StudentGateway | null>(null);
