import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { ProfileLeaveDialog } from "./ProfileLeaveDialog";
import { Load } from "./shared";
import { useLoad, useStudent } from "./hooks";
import { ProfileEditor } from "./ProfileEditor";
import { AvatarEditor } from "./AvatarEditor";
import type { StudentProfilePrivate, ReferenceDataResponse } from "./contracts";

function ProfileContent({
  initial,
  reference,
}: {
  initial: StudentProfilePrivate;
  reference: ReferenceDataResponse;
}) {
  const [profile, setProfile] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const handleDirty = useCallback((value: boolean) => {
    setDirty(value);
    if (value) setNotice("");
  }, []);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty) blocker.proceed();
  }, [blocker, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  return (
    <>
      {blocker.state === "blocked" && (
        <ProfileLeaveDialog
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
        />
      )}
      <ProfileEditor
        key={editorRevision}
        profile={profile}
        reference={reference}
        onDirty={handleDirty}
        onRebased={(latest) => {
          setProfile(latest);
          setNotice("");
        }}
        onSaved={(updated) => {
          setProfile(updated);
          setEditorRevision((x) => x + 1);
          setDirty(false);
          setNotice("Профиль сохранён");
        }}
      />
      {notice && <p role="status">{notice}</p>}
      <hr className="student-divider" />
      <AvatarEditor
        profile={profile}
        disabled={dirty}
        onSaved={(updated) => {
          setProfile(updated);
          setEditorRevision((x) => x + 1);
          setDirty(false);
          setNotice("");
        }}
      />
    </>
  );
}
export function ProfilePage() {
  const { api } = useStudent();
  const state = useLoad(
    async () => ({
      profile: await api.profile(),
      reference: await api.reference(),
    }),
    "profile",
  );
  return (
    <>
      <h1>Мой профиль</h1>
      <p className="student-lead">
        Укажите опыт и навыки, которые помогут найти команду.
      </p>
      <Load state={state}>
        {(data) => (
          <ProfileContent initial={data.profile} reference={data.reference} />
        )}
      </Load>
    </>
  );
}
