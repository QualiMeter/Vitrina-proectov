import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { useAction, useStudent } from "./hooks";
import { executionDemoExtras } from "./executionDemo";
import type { UploadedFileStatus } from "./contracts";
export type DraftAttachment = {
  id: string;
  name: string;
  status: UploadedFileStatus;
};
export function SubmissionFiles({
  caseId,
  checkpointId,
  applicationId,
  items,
  onChange,
  disabled,
  onBusy,
  onPending,
}: {
  caseId: string;
  checkpointId: string;
  applicationId: string;
  items: DraftAttachment[];
  onChange: (files: DraftAttachment[]) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onPending: (pending: boolean) => void;
}) {
  const { api, demo } = useStudent(),
    action = useAction();
  const [file, setFile] = useState<File>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => onBusy(action.busy), [action.busy, onBusy]);
  useEffect(() => onPending(!!file), [file, onPending]);
  return (
    <fieldset disabled={disabled || action.busy}>
      <legend>Файлы результата</legend>
      <p className="student-note">
        {demo
          ? "Учебные настройки: PDF, PNG, JPEG до 5 МБ. Это пример, не ограничения рабочего сервера."
          : "Настройки файлов пока недоступны. Допустимые типы и размер проверяются при загрузке."}
      </p>
      <label className="field">
        Выберите файл
        <input
          ref={input}
          className="student-file"
          type="file"
          accept={
            demo ? executionDemoExtras.acceptedTypes.join(",") : undefined
          }
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        disabled={!file || items.length >= 30}
        onClick={() =>
          void action.run(async () => {
            if (!file) return;
            const uploaded = await api.uploadSubmissionFile(
              caseId,
              checkpointId,
              applicationId,
              file,
            );
            onChange([
              ...items,
              { id: uploaded.fileId, name: file.name, status: uploaded.status },
            ]);
            setFile(undefined);
            if (input.current) input.current.value = "";
          }, "Файл загружен. В сдачу можно включать только проверенные файлы READY.")
        }
      >
        Загрузить файл
      </Button>
      {action.feedback}
      <ul className="student-list">
        {items.map((item) => (
          <li key={item.id}>
            {item.name} ·{" "}
            {item.status === "READY"
              ? "Готов к отправке"
              : `Проверка файла: ${item.status}`}
            {item.status !== "READY" && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void action.run(async () => {
                    const current = await api.fileMetadata(item.id);
                    onChange(
                      items.map((x) =>
                        x.id === item.id ? { ...x, status: current.status } : x,
                      ),
                    );
                  }, "Статус файла обновлён")
                }
              >
                Проверить статус {item.name}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            >
              Убрать {item.name}
            </Button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
