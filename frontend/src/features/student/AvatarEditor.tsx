import { useEffect, useState } from "react";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { StudentAvatar } from "./shared";
import { useAction, useStudent } from "./hooks";
import type { StudentProfilePrivate } from "./contracts";

export function AvatarEditor({
  profile,
  disabled,
  onSaved,
}: {
  profile: StudentProfilePrivate;
  disabled: boolean;
  onSaved: (profile: StudentProfilePrivate) => void;
}) {
  const { api, demo } = useStudent();
  const action = useAction();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setPreview("");
    setPreviewError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPreviewError("Выберите файл изображения.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const reset = () => {
    setFile(undefined);
    setRevision((x) => x + 1);
  };
  return (
    <section aria-label="Аватар" className="student-stack">
      <h2>Аватар</h2>
      <p>Текущее изображение</p>
      <StudentAvatar
        key={profile.avatarUrl ?? "empty"}
        id={profile.userId}
        present={Boolean(profile.avatarUrl)}
        nickname={profile.nickname}
        demo={demo}
      />
      <form
        className="student-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            if (!file || disabled || !file.type.startsWith("image/"))
              throw new Error(
                "Выберите изображение и сохраните изменения профиля.",
              );
            const updated = await api.avatar(file);
            onSaved(updated);
            reset();
          }, "Аватар загружен");
        }}
      >
        <p className="student-note">
          Предпросмотр виден только вам. Фото появится в публичном профиле после
          проверки.
        </p>
        <Input
          key={revision}
          label="Изображение профиля"
          type="file"
          accept="image/*"
          disabled={action.busy}
          onChange={(e) => setFile(e.target.files?.[0])}
        />
        {preview && (
          <img
            src={preview}
            className="student-avatar"
            alt="Предварительный просмотр выбранного аватара"
            onError={() =>
              setPreviewError("Не удалось отобразить выбранное изображение.")
            }
          />
        )}
        {previewError && <p role="alert">{previewError}</p>}
        {disabled && <p>Сначала сохраните изменения профиля.</p>}
        <div className="student-actions">
          <Button
            disabled={
              action.busy || disabled || !file || Boolean(previewError) || demo
            }
          >
            Загрузить аватар
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy || disabled || !profile.avatarUrl}
            onClick={() =>
              void action.run(async () => {
                const updated = await api.avatar();
                onSaved(updated);
                reset();
              }, "Аватар удалён")
            }
          >
            Удалить аватар
          </Button>
        </div>
        {action.feedback}
        {demo && <p>В деморежиме доступен только предпросмотр.</p>}
      </form>
    </section>
  );
}
