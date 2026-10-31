import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  MemoryRouter,
  Routes,
  Route,
} from "react-router-dom";
import { studentRoutes } from "./routes";
import { createDemoGateway } from "./demo";
import { liveStudentGateway } from "./gateway";
import { StudentProjectsBlock } from "./StudentProjectsBlock";
import { PublicProfilePage } from "./ProfilePages";
import { safeUrl } from "./hooks";

afterEach(() => vi.unstubAllGlobals());
function demo(path: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(studentRoutes, { initialEntries: [path] })}
    />,
  );
}
describe("Frontend B day 1", () => {
  it("does not offer unsupported PATCH clearing of saved academic fields", async () => {
    demo("/demo/student/profile");
    const institute = await screen.findByLabelText("Институт / факультет");
    expect(institute.querySelector('option[value=""]')).toBeDisabled();
    expect(screen.getByLabelText("Курс")).toBeRequired();
    expect(screen.getByText(/Очистка станет доступна/)).toBeInTheDocument();
  });
  it("shows the dashboard and required navigation sections", async () => {
    demo("/demo/student");
    expect(
      await screen.findByRole("heading", { name: "student_demo" }),
    ).toBeInTheDocument();
    for (const name of [
      "Мой профиль",
      "Мои участия",
      "Приглашения",
      "Портфолио",
      "Мои проекты",
    ])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Мой профиль" })).toHaveAttribute(
      "href",
      "/demo/student/profile",
    );
  });
  it("saves the profile and shows updated public fields without exposing academic data", async () => {
    const user = userEvent.setup();
    demo("/demo/student/profile");
    const nickname = await screen.findByLabelText("Никнейм");
    await user.clear(nickname);
    await user.type(nickname, "updated_nick");
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Никнейм")).toHaveValue("updated_nick"),
    );
    await user.click(
      screen.getByRole("link", { name: "Посмотреть публичный профиль" }),
    );
    expect(
      await screen.findByRole("heading", { name: "updated_nick" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Демо Студент")).not.toBeInTheDocument();
    expect(screen.queryByText("ДЕМО-201")).not.toBeInTheDocument();
  });
  it("renders participation roles and a workspace transition without implementing later-day work", async () => {
    const user = userEvent.setup();
    demo("/demo/student/participations");
    expect(
      await screen.findByRole("heading", {
        name: "Сервис для студенческих команд",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Капитан")).toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Рабочее пространство" }),
    );
    expect(
      await screen.findByText("Раздел пока недоступен"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Отправить заявку" }),
    ).not.toBeInTheDocument();
  });
  it("renders the personal invitation center introduced on day 2", async () => {
    demo("/demo/student/invitations");
    expect(
      await screen.findByRole("button", { name: "Принять" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Раздел пока недоступен"),
    ).not.toBeInTheDocument();
  });
  it("filters unpublished initiatives out of the embeddable FE-A block", () => {
    render(
      <MemoryRouter>
        <StudentProjectsBlock
          projects={[
            {
              id: "draft",
              title: "PRIVATE DRAFT",
              moderationStatus: "DRAFT",
              developmentStatus: "IDEA",
              technologies: [],
              seekingTeam: false,
            },
            {
              id: "public",
              title: "PUBLIC PROJECT",
              moderationStatus: "PUBLISHED",
              developmentStatus: "RECRUITING",
              technologies: ["React"],
              seekingTeam: true,
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("PRIVATE DRAFT")).not.toBeInTheDocument();
    expect(screen.getByText("PUBLIC PROJECT")).toBeInTheDocument();
    expect(screen.getByText("Ищу команду")).toBeInTheDocument();
  });
  it("does not request private data before authentication", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    demo("/student/profile");
    expect(
      await screen.findByText("Сессия завершилась. Войдите снова."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/auth/me");
    expect(screen.queryByLabelText("ФИО")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Войти через общий экран входа" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Вернуться на главную" }),
    ).toHaveAttribute("href", "/");
  });
  it("does not grant a company account access to the student area", async () => {
    const session = await createDemoGateway().session();
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        ...session,
        user: { ...session.user, availableAreas: ["company"] },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    demo("/student/profile");
    expect(
      await screen.findByText("Кабинет студента недоступен"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("ignores unexpected private fields returned by a public profile endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          studentId: "id",
          nickname: "public_nick",
          avatarUrl: null,
          achievements: [],
          skillIds: [],
          technologyIds: [],
          publicLinks: [],
          fullName: "PRIVATE NAME",
          studyGroup: "PRIVATE GROUP",
          course: 5,
        }),
      ),
    );
    render(
      <MemoryRouter initialEntries={["/students/id"]}>
        <Routes>
          <Route path="/students/:id" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "public_nick" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE NAME")).not.toBeInTheDocument();
    expect(screen.queryByText("PRIVATE GROUP")).not.toBeInTheDocument();
  });
  it("uses fresh CSRF, existing credentials and expectedVersion when updating a profile", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-test" }))
      .mockResolvedValueOnce(Response.json({ version: 2 }));
    vi.stubGlobal("fetch", fetch);
    await liveStudentGateway.updateProfile({
      expectedVersion: 1,
      nickname: "new_name",
    });
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    const [path, options] = fetch.mock.calls[1];
    expect(path).toBe("/api/v1/me/student-profile");
    expect(options).toMatchObject({
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "X-CSRF-Token": "csrf-test",
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(options.body)).toEqual({
      expectedVersion: 1,
      nickname: "new_name",
    });
  });
  it("uploads an avatar with FormData and leaves boundary selection to the browser", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-test" }))
      .mockResolvedValueOnce(Response.json({ version: 2 }));
    vi.stubGlobal("fetch", fetch);
    await liveStudentGateway.avatar(
      new File(["image"], "avatar.png", { type: "image/png" }),
    );
    expect(fetch.mock.calls[1][1].body).toBeInstanceOf(FormData);
    expect(fetch.mock.calls[1][1].headers["Content-Type"]).toBeUndefined();
  });
  it("never replaces forbidden live data with demo fixtures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    await expect(liveStudentGateway.profile()).rejects.toMatchObject({
      kind: "forbidden",
      status: 403,
    });
  });
  it("uses version checking in the typed profile demo", async () => {
    const api = createDemoGateway();
    const profile = await api.profile();
    await api.updateProfile({
      expectedVersion: profile.version,
      nickname: "updated",
    });
    await expect(
      api.updateProfile({
        expectedVersion: profile.version,
        nickname: "stale",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects unsafe outbound profile links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,test")).toBeUndefined();
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
  });
});
