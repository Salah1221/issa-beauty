import { diffStatuses, getNotifications, addNotifications, markAllRead, unreadCount } from "./notifications";
import { TrackedOrder, TrackedOrderView } from "./orderTypes";

const tracked = (n: string, s: TrackedOrder["lastSeenStatus"]): TrackedOrder => ({ orderNumber: n, phone: "03", lastSeenStatus: s, addedAt: "" });
const view = (n: string, s: TrackedOrderView["status"]): TrackedOrderView => ({ orderNumber: n, status: s, total: 1, itemCount: 1, createdAt: "", updatedAt: "" });

describe("diffStatuses", () => {
  it("flags only orders whose status changed", () => {
    const changes = diffStatuses([tracked("IB-1", "pending"), tracked("IB-2", "confirmed")], [view("IB-1", "confirmed"), view("IB-2", "confirmed")]);
    expect(changes).toEqual([{ orderNumber: "IB-1", status: "confirmed" }]);
  });
  it("returns nothing when all match", () => {
    expect(diffStatuses([tracked("IB-1", "pending")], [view("IB-1", "pending")])).toEqual([]);
  });
});

describe("notification store", () => {
  it("adds, counts unread, and marks read", () => {
    addNotifications([{ orderNumber: "IB-1", status: "confirmed" }]);
    expect(getNotifications()).toHaveLength(1);
    expect(unreadCount()).toBe(1);
    markAllRead();
    expect(unreadCount()).toBe(0);
  });
});
