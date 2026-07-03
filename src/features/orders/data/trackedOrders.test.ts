import { getTrackedOrders, addTrackedOrder, removeTrackedOrder, setLastSeenStatus } from "./trackedOrders";

it("adds and reads a tracked order", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  expect(getTrackedOrders()).toEqual([
    expect.objectContaining({ orderNumber: "IB-1", phone: "03", lastSeenStatus: "pending" }),
  ]);
});
it("is idempotent by orderNumber (updates phone/status, no dupes)", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  addTrackedOrder({ orderNumber: "IB-1", phone: "099", status: "confirmed" });
  const all = getTrackedOrders();
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({ phone: "099", lastSeenStatus: "confirmed" });
});
it("removes and updates last-seen status", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  setLastSeenStatus("IB-1", "delivered");
  expect(getTrackedOrders()[0].lastSeenStatus).toBe("delivered");
  removeTrackedOrder("IB-1");
  expect(getTrackedOrders()).toEqual([]);
});
it("treats corrupt storage as empty", () => {
  localStorage.setItem("issa.trackedOrders", "not json");
  expect(getTrackedOrders()).toEqual([]);
});
