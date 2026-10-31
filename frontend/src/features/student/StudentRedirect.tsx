import { Navigate } from "react-router-dom";
import { useStudent } from "./hooks";
export function StudentRedirect({ to }: { to: string }) {
  const { base } = useStudent();
  return <Navigate to={`${base}/${to}`} replace />;
}
