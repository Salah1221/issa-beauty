import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { vi } from "vitest";

vi.mock("@/features/cart/data/CartContext", () => ({
  useCart: () => ({
    items: [
      { productId: "p1", name: "Lipstick", quantity: 1, price: 10, discountPercentage: 0 },
    ],
    subtotal: 10,
    clear: vi.fn(),
  }),
  discountedPrice: (price: number) => price,
}));

const mockUser = {
  email: "jane@x.com",
  profile: {
    fullName: "Jane Doe",
    phone: "+961 12345678",
    address: "1 Main St",
    city: "Beirut",
    area: "Hamra",
    notes: "call first",
  },
};

// Mutable holder so tests can control what useAuth returns across rerenders
// (auth resolves async in real life: user is null first, then arrives).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authValue: any = {
  user: mockUser,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
};
vi.mock("@/features/auth/data/AuthContext", () => ({
  useAuth: () => authValue,
}));

import CheckoutPage from "./CheckoutPage";

// A fresh element each call. Reusing one element reference makes React bail out
// of reconciliation on rerender; a new element of the same component type
// reconciles to the same instance (state + refs persist) without remounting.
const makeTree = () => (
  <HelmetProvider>
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>
  </HelmetProvider>
);

function renderPage() {
  return render(makeTree());
}

it("pre-fills the form from the logged-in user's saved profile", async () => {
  authValue = { user: mockUser, loading: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() };
  renderPage();
  await waitFor(() => {
    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
  });
  expect(screen.getByLabelText("Phone number")).toHaveValue("12345678");
  expect(screen.getByLabelText("Email")).toHaveValue("jane@x.com");
  expect(screen.getByLabelText("Address")).toHaveValue("1 Main St");
  expect(screen.getByLabelText("City")).toHaveValue("Beirut");
  expect(screen.getByLabelText("Area")).toHaveValue("Hamra");
});

it("does not overwrite fields the shopper already typed before the profile arrives", async () => {
  authValue = { user: null, loading: true, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() };
  const { rerender } = renderPage();

  // Shopper starts typing while auth is still resolving.
  const nameInput = screen.getByLabelText("Full name");
  await userEvent.type(nameInput, "Typed Name");

  // Profile arrives after typing. Rerender the SAME element so the component
  // instance (and its seededRef guard + typed form state) persists across the
  // null -> user transition, letting the seeding effect fire once with input
  // already present.
  authValue = { user: mockUser, loading: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() };
  rerender(makeTree());

  // Typed field is preserved; the empty Address field is seeded from profile.
  expect(screen.getByLabelText("Full name")).toHaveValue("Typed Name");
  await waitFor(() => expect(screen.getByLabelText("Address")).toHaveValue("1 Main St"));
});
