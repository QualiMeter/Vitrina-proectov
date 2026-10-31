import { useState } from "react";
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
  return (
    <>
      <ProfileEditor
        key={profile.version}
        profile={profile}
        reference={reference}
        onDirty={() => setDirty(true)}
        onSaved={(updated) => {
          setProfile(updated);
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
