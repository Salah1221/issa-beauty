import { OrderStatus, TrackedOrder } from "./orderTypes";

const KEY = "issa.trackedOrders";

export function getTrackedOrders(): TrackedOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedOrder[]) : [];
  } catch {
    return [];
  }
}

function save(orders: TrackedOrder[]): void {
  localStorage.setItem(KEY, JSON.stringify(orders));
}

export function addTrackedOrder(o: { orderNumber: string; phone: string; status: OrderStatus }): void {
  const orders = getTrackedOrders();
  const existing = orders.find((t) => t.orderNumber === o.orderNumber);
  if (existing) {
    existing.phone = o.phone;
    existing.lastSeenStatus = o.status;
  } else {
    orders.push({ orderNumber: o.orderNumber, phone: o.phone, lastSeenStatus: o.status, addedAt: new Date().toISOString() });
  }
  save(orders);
}

export function removeTrackedOrder(orderNumber: string): void {
  save(getTrackedOrders().filter((t) => t.orderNumber !== orderNumber));
}

export function setLastSeenStatus(orderNumber: string, status: OrderStatus): void {
  const orders = getTrackedOrders();
  const t = orders.find((x) => x.orderNumber === orderNumber);
  if (t) {
    t.lastSeenStatus = status;
    save(orders);
  }
}
