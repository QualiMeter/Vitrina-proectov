import { Load } from './shared';
import { useLoad, useStudent } from './hooks';
import { ProfileEditor } from './ProfileEditor';
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
          <ProfileEditor
            key={data.profile.version}
            {...data}
            refresh={state.reload}
          />
        )}
      </Load>
    </>
  );
}

