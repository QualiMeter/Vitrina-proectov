import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button, ButtonLink } from "../../components/ui/Button";
import type * as C from "./contracts";
import { Load, Status } from "./shared";
import { date, useAction, useLoad, useStudent } from "./hooks";
function TeamEditor({
  initial,
  details,
}: {
  initial: C.CaseTeam;
  details: C.CasePublicDetails;
}) {
  const { api, user, base } = useStudent();
  const action = useAction();
  const navigate = useNavigate();
  const [team, setTeam] = useState(initial);
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState("");
  const candidates = useLoad(
    () =>
      searched.length >= 2
        ? api.candidates(team.id, searched)
        : Promise.resolve({ items: [] } satisfies C.StudentInviteCandidateList),
    `candidates-${team.id}-${searched}`,
  );
  const captain = team.captainUserId === user.id;
  const open =
    details.status === "REGISTRATION_OPEN" &&
    Date.parse(details.registrationDeadline) > Date.now();
  const canEdit = captain && !team.membershipLocked && open;
  const refresh = async () => setTeam(await api.team(team.id));
  return (
    <>
      <Card>
        <h2>{team.name}</h2>
        <p className="student-note">
          {details.title} · Набор до {date(details.registrationDeadline)} ·
          Команда: {details.minTeamSize ?? 1}–
          {details.maxTeamSize ?? "без ограничения"}
        </p>
        <p>
          {team.membershipLocked
            ? "Заявка отправлена: состав команды зафиксирован."
            : "Состав можно менять до отправки заявки."}
        </p>
        <div className="student-table">
          <table>
            <caption>Подтверждённые участники</caption>
            <thead>
              <tr>
                <th scope="col">Участник</th>
                <th scope="col">Роль</th>
                <th scope="col">Подтверждение</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.userId}>
                  <td>{member.displayName}</td>
                  <td>{member.isCaptain ? "Капитан" : "Участник"}</td>
                  <td>Подтверждено {date(member.joinedAt)}</td>
                  <td>
                    {open &&
                      !team.membershipLocked &&
                      !member.isCaptain &&
                      (captain || member.userId === user.id) && (
                        <Button
                          variant="ghost"
                          disabled={action.busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                member.userId === user.id
                                  ? "Покинуть команду?"
                                  : "Исключить участника из команды?",
                              )
                            )
                              void action.run(async () => {
                                const updated = await api.removeMember(
                                  team.id,
                                  member.userId,
                                );
                                if (member.userId === user.id)
                                  navigate(`${base}/participations`);
                                else setTeam(updated);
                              });
                          }}
                        >
                          {member.userId === user.id ? "Покинуть" : "Исключить"}
                        </Button>
                      )}
                    {canEdit && member.userId !== user.id && (
                      <Button
                        variant="ghost"
                        disabled={
                          action.busy ||
                          team.captainTransfer?.status === "PENDING"
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              "Предложить передачу капитанства? Участник должен подтвердить её лично.",
                            )
                          )
                            void action.run(async () => {
                              await api.transfer(team.id, member.userId);
                              await refresh();
                            });
                        }}
                      >
                        Предложить капитанство
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {team.captainTransfer && (
          <p>
            Передача капитанства: <Status value={team.captainTransfer.status} />
          </p>
        )}
        {team.captainTransfer?.status === "PENDING" &&
          team.captainTransfer.toUserId === user.id && (
            <div className="student-actions">
              {(["CONFIRM", "DECLINE"] as const).map((value) => (
                <Button
                  key={value}
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await api.decideTransfer(
                        team.id,
                        team.captainTransfer!.id,
                        value,
                      );
                      await refresh();
                    })
                  }
                >
                  {value === "CONFIRM"
                    ? "Подтвердить капитанство"
                    : "Отказаться от капитанства"}
                </Button>
              ))}
            </div>
          )}
        <h2>Приглашения</h2>
        {team.pendingInvitations.length ? (
          <ul className="student-list">
            {team.pendingInvitations.map((invite) => (
              <li key={invite.id}>
                Участник {invite.inviteeUserId} ·{" "}
                <Status value={invite.status} />
                {canEdit && invite.status === "PENDING" && (
                  <Button
                    variant="ghost"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await api.decideInvitation(invite.id, "revoke");
                        await refresh();
                      })
                    }
                  >
                    Отозвать приглашение
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Нет приглашений.</p>
        )}
        {canEdit && (
          <form
            className="student-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSearched(search.trim());
            }}
          >
            <Input
              label="Найти студента"
              minLength={2}
              maxLength={120}
              required
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              hint="Поиск без доступа к закрытым контактам."
            />
            <Button variant="secondary">Найти</Button>
          </form>
        )}
        {canEdit && searched.length >= 2 && (
          <Load state={candidates}>
            {(data) =>
              data.items.length ? (
                <ul>
                  {data.items.map((candidate) => (
                    <li key={candidate.userId}>
                      {candidate.displayName}
                      {candidate.course && ` · ${candidate.course} курс`}
                      <Button
                        variant="ghost"
                        disabled={
                          action.busy ||
                          team.members.some(
                            (x) => x.userId === candidate.userId,
                          ) ||
                          team.pendingInvitations.some(
                            (x) =>
                              x.inviteeUserId === candidate.userId &&
                              x.status === "PENDING",
                          )
                        }
                        onClick={() =>
                          void action.run(async () => {
                            await api.invite(team.id, candidate.userId);
                            await refresh();
                          })
                        }
                      >
                        Пригласить
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Никого не найдено.</p>
              )
            }
          </Load>
        )}
        {action.feedback}
        <div className="student-actions">
          <Button
            variant="secondary"
            disabled={action.busy}
            onClick={() => void action.run(refresh, "Состав обновлён")}
          >
            Обновить состав
          </Button>
          {captain && (
            <ButtonLink to={`${base}/cases/${team.caseId}/apply`}>
              Открыть заявку
            </ButtonLink>
          )}
        </div>
      </Card>
    </>
  );
}
export function TeamPage() {
  const { teamId = "" } = useParams();
  const { api } = useStudent();
  const state = useLoad(async () => {
    const team = await api.team(teamId);
    return { team, details: await api.caseDetails(team.caseId) };
  }, `team-${teamId}`);
  return (
    <>
      <h1>Команда кейса</h1>
      <Load state={state}>
        {({ team, details }) => (
          <TeamEditor key={team.id} initial={team} details={details} />
        )}
      </Load>
    </>
  );
}
