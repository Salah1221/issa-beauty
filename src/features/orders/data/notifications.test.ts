import { diffStatuses, getLastSeen, setLastSeen, addNotifications, getNotifications, markAllRead, unreadCount } from "./notifications";
import { TrackedOrderView } from "./orderTypes";
const view = (n: string, s: TrackedOrderView["status"]): TrackedOrderView => ({ orderNumber: n, status: s, total: 1, itemCount: 1, createdAt: "", updatedAt: "" });

describe("diffStatuses", () => {
  it("flags only orders seen before at a different status", () => {
    const changes = diffStatuses({ "IB-1": "pending", "IB-2": "confirmed" }, [view("IB-1", "confirmed"), view("IB-2", "confirmed"), view("IB-NEW", "pending")]);
    expect(changes).toEqual([{ orderNumber: "IB-1", status: "confirmed" }]);
  });
});
describe("per-user store", () => {
  it("keeps lastSeen and notifications separate per user key", () => {
    setLastSeen("a@x.com", { "IB-1": "pending" });
    expect(getLastSeen("a@x.com")).toEqual({ "IB-1": "pending" });
    expect(getLastSeen("b@x.com")).toEqual({});
    addNotifications("a@x.com", [{ orderNumber: "IB-1", status: "confirmed" }]);
    expect(getNotifications("a@x.com")).toHaveLength(1);
    expect(getNotifications("b@x.com")).toHaveLength(0);
    expect(unreadCount("a@x.com")).toBe(1);
    markAllRead("a@x.com");
    expect(unreadCount("a@x.com")).toBe(0);
  });
});
