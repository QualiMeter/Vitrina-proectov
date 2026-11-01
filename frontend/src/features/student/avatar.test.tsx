import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AvatarEditor } from "./AvatarEditor";
import { createDemoGateway } from "./demo";
import { StudentContext } from "./hooks";

afterEach(() => vi.unstubAllGlobals());
it("previews a selected file, uploads it and keeps feedback next to the avatar form", async () => {
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:avatar-test";
      }
      static revokeObjectURL(value: string) {
        revoke(value);
      }
    },
  );
  const api = createDemoGateway();
  const user = (await api.session()).user;
  const profile = await api.profile();
  api.avatar = vi.fn(async () => ({
    ...profile,
    version: 2,
    avatarUrl: "/api/v1/public/students/test/avatar",
  }));
  const saved = vi.fn();
  const view = render(
    <MemoryRouter>
      <StudentContext.Provider
        value={{ api, user, demo: false, base: "/student" }}
      >
        <AvatarEditor profile={profile} disabled={false} onSaved={saved} />
      </StudentContext.Provider>
    </MemoryRouter>,
  );
  const actor = userEvent.setup();
  const file = new File(["image"], "avatar.png", { type: "image/png" });
  await actor.upload(screen.getByLabelText("Изображение профиля"), file);
  expect(
    await screen.findByAltText("Предварительный просмотр выбранного аватара"),
  ).toHaveAttribute("src", "blob:avatar-test");
  await actor.click(screen.getByRole("button", { name: "Загрузить аватар" }));
  expect(await screen.findByText("Аватар загружен")).toBeInTheDocument();
  expect(api.avatar).toHaveBeenCalledWith(file);
  expect(saved).toHaveBeenCalled();
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:avatar-test"));
  view.unmount();
});

it("does not allow avatar mutations while unsaved profile fields would be lost", async () => {
  const api = createDemoGateway();
  const user = (await api.session()).user;
  const profile = { ...(await api.profile()), avatarUrl: "/existing" };
  render(
    <MemoryRouter>
      <StudentContext.Provider
        value={{ api, user, demo: false, base: "/student" }}
      >
        <AvatarEditor profile={profile} disabled onSaved={() => {}} />
      </StudentContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.getByRole("button", { name: "Удалить аватар" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Загрузить аватар" }),
  ).toBeDisabled();
  expect(
    screen.getByText(/Сначала сохраните изменения профиля/),
  ).toBeInTheDocument();
});
