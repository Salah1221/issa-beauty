import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
vi.mock("./auth", () => ({
  getMe: vi.fn(async () => ({ type: "success", data: { email: "a@b.com" } })),
  login: vi.fn(), logout: vi.fn(async () => ({ type: "success", data: null })),
}));
import { AuthProvider, useAuth } from "./AuthContext";
function Show() { const { user } = useAuth(); return <span>{user?.email ?? "none"}</span>; }
it("loads the current user from getMe", async () => {
  render(<AuthProvider><Show /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());
});
