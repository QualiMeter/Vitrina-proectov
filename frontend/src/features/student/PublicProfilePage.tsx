import { useContext } from "react";
import { Link, useParams } from "react-router-dom";
import { DemoGatewayContext } from "./demoContext";
import { liveStudentGateway } from "./gateway";
import { ExternalLink, Load, StudentAvatar } from "./shared";
import { useLoad } from "./hooks";
export function PublicProfilePage({ demo = false }: { demo?: boolean }) {
  const { id = "" } = useParams();
  const demoApi = useContext(DemoGatewayContext);
  const state = useLoad(async () => {
    if (demo && demoApi) return demoApi.publicProfile(id);
    return liveStudentGateway.publicProfile(id);
  }, `public-${id}-${demo}`);
  return (
    <main className="student-public">
      <Link to="/">← На главную</Link>
      {demo && (
        <p className="student-demo">Демонстрационный публичный профиль</p>
      )}
      <Load state={state}>
        {(profile) => (
          <>
            <StudentAvatar
              id={profile.studentId}
              present={Boolean(profile.avatarUrl)}
              nickname={profile.nickname}
              demo={demo}
            />
            <h1>{profile.nickname}</h1>
            <p>{profile.publicSummary}</p>
            <h2>Достижения</h2>
            {profile.achievements.length ? (
              <ul>
                {profile.achievements.map((x, i) => (
                  <li key={i}>
                    {x.title}
                    {x.description && <p>{x.description}</p>}
                    {x.url && (
                      <ExternalLink url={x.url}>Подробнее</ExternalLink>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Достижения пока не добавлены.</p>
            )}
            <h2>Публичные ссылки</h2>
            {profile.publicLinks.map((x, i) => (
              <p key={i}>
                <ExternalLink url={x.url}>{x.label}</ExternalLink>
              </p>
            ))}
            <p>
              <Link
                to={
                  demo
                    ? "/demo/student/portfolio"
                    : `/students/${encodeURIComponent(id)}/portfolio`
                }
              >
                Публичное портфолио
              </Link>
            </p>
          </>
        )}
      </Load>
    </main>
  );
}
