import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useAction } from "../hooks";
import type { Media } from "./models";
import { usePublications } from "./context";
import { MediaPreview } from "./PublicationsUI";
export function MediaFields({
  demo,
  items,
  onChange,
  onBusy,
  onPending,
}: {
  demo: boolean;
  items: Media[];
  onChange: (items: Media[]) => void;
  onBusy: (busy: boolean) => void;
  onPending: (pending: boolean) => void;
}) {
  const api = usePublications(demo),
    action = useAction();
  const input = useRef<HTMLInputElement>(null),
    [file, setFile] = useState<File>();
  const [purpose, setPurpose] = useState<Media["purpose"]>("IMAGE");
  useEffect(() => onPending(!!file), [file, onPending]);
  return (
    <fieldset disabled={action.busy}>
      <legend>Изображения и материалы</legend>
      <p className="student-note">
        Учебная загрузка: PNG/JPEG/WebP или PDF/ZIP/TXT до 10 МБ. Это настройки
        примера.
      </p>
      <label className="field">
        Тип вложения
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Media["purpose"])}
        >
          <option value="IMAGE">Изображение</option>
          <option value="MATERIAL">Материал</option>
        </select>
      </label>
      <label className="field">
        Файл публикации
        <input
          ref={input}
          className="student-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        disabled={!file}
        onClick={() =>
          void action.run(async () => {
            if (!file) return;
            onBusy(true);
            try {
              const media = await api.upload(file, purpose);
              onChange([...items, media]);
              setFile(undefined);
              if (input.current) input.current.value = "";
            } finally {
              onBusy(false);
            }
          }, "Файл добавлен к черновику")
        }
      >
        Добавить файл
      </Button>
      {file && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFile(undefined);
            if (input.current) input.current.value = "";
            action.clear();
          }}
        >
          Отменить выбор файла
        </Button>
      )}
      {action.feedback}
      <div className="publication-media-grid">
        {items.map((item) => (
          <div key={item.id}>
            <MediaPreview item={item} demo={demo} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            >
              Убрать {item.name}
            </Button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
