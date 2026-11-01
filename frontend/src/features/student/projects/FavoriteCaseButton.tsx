import { useContext } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { useStudent, useAction, useLoad } from "../hooks";
import { ProjectManagementContext } from "./context";
export function FavoriteCaseButton({ caseId }: { caseId: string }) {
  const api = useContext(ProjectManagementContext),
    { demo, base } = useStudent();
  if (!demo || !api)
    return <Link to={`${base}/favorites`}>Избранные кейсы</Link>;
  return <FavoriteControl caseId={caseId} />;
}
function FavoriteControl({ caseId }: { caseId: string }) {
  const api = useContext(ProjectManagementContext)!,
    action = useAction(),
    state = useLoad(() => api.favorites(), `favorite-${caseId}`),
    saved = state.data?.some((x) => x.caseId === caseId);
  return (
    <>
      <Button
        variant="secondary"
        disabled={action.busy || !state.data}
        onClick={() =>
          void action.run(
            async () => {
              await api.setFavorite(caseId, !saved);
              state.reload();
            },
            saved ? "Кейс удалён из избранного" : "Кейс сохранён в избранном",
          )
        }
      >
        {saved ? "Убрать кейс из избранного" : "Сохранить кейс в избранное"}
      </Button>
      {action.feedback}
      {state.error && (
        <Button variant="ghost" onClick={state.reload}>
          Повторить загрузку избранного
        </Button>
      )}
    </>
  );
}
