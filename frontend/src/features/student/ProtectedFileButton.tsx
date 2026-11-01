import { Button } from "../../components/ui/Button";
import { useAction, useStudent } from "./hooks";
export function ProtectedFileButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const { api } = useStudent(),
    action = useAction();
  return (
    <div className="student-file-action">
      <Button
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          void action.run(
            () => api.downloadFile(id, name),
            "Файл передан браузеру",
          )
        }
      >
        {action.busy ? "Скачивание…" : `Скачать ${name}`}
      </Button>
      {action.feedback}
    </div>
  );
}
