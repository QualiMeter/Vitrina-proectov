import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Load, Status } from "./shared";
import { date, useAction, useLoad, useStudent } from "./hooks";
import { submissionBlocks } from "./applicationRules";
import { ApplicationEditor } from "./ApplicationEditor";
export function ApplicationPage() {
  const { caseId = "" } = useParams();
  const { api, user, base } = useStudent();
  const action = useAction();
  const [format, setFormat] = useState<"SOLO" | "TEAM">("SOLO");
  const [name, setName] = useState("");
  const state = useLoad(async () => {
    const [details, profile, teams, apps, nda] = await Promise.all([
      api.caseDetails(caseId),
      api.profile(),
      api.teams(caseId),
      api.applications(caseId),
      api.nda(caseId),
    ]);
    return { details, profile, teams, apps, nda };
  }, `application-${caseId}`);
  return (
    <>
      <h1>Участвовать в кейсе</h1>
      <Load state={state}>
        {({ details, profile, teams, apps, nda }) => {
          const app = apps.items[0];
          const team = app?.teamId
            ? teams.items.find((t) => t.id === app.teamId)
            : teams.items[0];
          const choice = team
            ? "TEAM"
            : details.participationFormat === "BOTH"
              ? format
              : details.participationFormat;
          const blocks = submissionBlocks(
            details,
            profile,
            choice === "TEAM" ? team : undefined,
          );
          return (
            <div className="student-stack">
              <Card>
                <h2>{details.title}</h2>
                <p>{details.companyName}</p>
                <p>{details.description}</p>
                <p>Срок заявки: {date(details.registrationDeadline)}</p>
                <p>
                  Курс: {details.minCourse ?? "любой"}–
                  {details.maxCourse ?? "любой"}. Команда:{" "}
                  {details.minTeamSize ?? 1}–
                  {details.maxTeamSize ?? "без ограничения"} участников.
                </p>
                <Status value={details.status} />
              </Card>
              {app ? (
                <ApplicationEditor
                  key={app.id}
                  initial={app}
                  details={details}
                  profile={profile}
                  team={team}
                  nda={nda}
                />
              ) : (
                <Card>
                  <h2>Выберите формат участия</h2>
                  <div className="student-form">
                    <fieldset>
                      <legend>Формат</legend>
                      {(["SOLO", "TEAM"] as const)
                        .filter((value) =>
                          team
                            ? value === "TEAM"
                            : details.participationFormat === "BOTH" ||
                              details.participationFormat === value,
                        )
                        .map((value) => (
                          <label key={value}>
                            <input
                              type="radio"
                              name="format"
                              value={value}
                              checked={choice === value}
                              onChange={() => setFormat(value)}
                            />
                            {value === "SOLO" ? "Индивидуально" : "Командой"}
                          </label>
                        ))}
                    </fieldset>
                    {choice === "TEAM" &&
                      (team ? (
                        <>
                          <p>Команда: {team.name}</p>
                          <Link to={`${base}/teams/${team.id}`}>
                            Управлять составом и приглашениями
                          </Link>
                        </>
                      ) : (
                        <form
                          className="student-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void action.run(async () => {
                              await api.createTeam(caseId, name.trim());
                              state.reload();
                            }, "Команда создана");
                          }}
                        >
                          <Input
                            label="Название команды"
                            minLength={2}
                            maxLength={120}
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                          <Button
                            disabled={
                              action.busy ||
                              details.status !== "REGISTRATION_OPEN"
                            }
                          >
                            Создать команду
                          </Button>
                        </form>
                      ))}
                    {!!blocks.length && (
                      <ul>
                        {blocks.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    )}
                    <Button
                      disabled={
                        action.busy ||
                        details.status !== "REGISTRATION_OPEN" ||
                        Date.parse(details.registrationDeadline) <=
                          Date.now() ||
                        (choice === "TEAM" &&
                          (!team || team.captainUserId !== user.id)) ||
                        (details.participationFormat !== "BOTH" &&
                          details.participationFormat !== choice)
                      }
                      onClick={() =>
                        void action.run(async () => {
                          await api.createApplication(
                            caseId,
                            choice === "SOLO"
                              ? { format: "SOLO" }
                              : { format: "TEAM", teamId: team!.id },
                          );
                          state.reload();
                        }, "Черновик создан")
                      }
                    >
                      Создать черновик заявки
                    </Button>
                  </div>
                  {action.feedback}
                </Card>
              )}
              <p>
                <Link to={`${base}/participations`}>← Мои участия</Link>
              </p>
            </div>
          );
        }}
      </Load>
    </>
  );
}
