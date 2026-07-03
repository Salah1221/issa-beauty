import { OrderStatus, TrackedOrder, TrackedOrderView } from "./orderTypes";

const KEY = "issa.orderNotifications";
let seq = 0;

export type OrderNotification = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  at: string;
  read: boolean;
};

export function diffStatuses(
  tracked: TrackedOrder[],
  views: TrackedOrderView[],
): { orderNumber: string; status: OrderStatus }[] {
  const seen = new Map(tracked.map((t) => [t.orderNumber, t.lastSeenStatus]));
  const changes: { orderNumber: string; status: OrderStatus }[] = [];
  for (const v of views) {
    if (seen.has(v.orderNumber) && seen.get(v.orderNumber) !== v.status) {
      changes.push({ orderNumber: v.orderNumber, status: v.status });
    }
  }
  return changes;
}

export function getNotifications(): OrderNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OrderNotification[]) : [];
  } catch {
    return [];
  }
}

function save(n: OrderNotification[]): void {
  localStorage.setItem(KEY, JSON.stringify(n));
}

export function addNotifications(
  changes: { orderNumber: string; status: OrderStatus }[],
): OrderNotification[] {
  const now = new Date().toISOString();
  const added: OrderNotification[] = changes.map((c) => ({
    id: `${now}-${c.orderNumber}-${seq++}`,
    orderNumber: c.orderNumber,
    status: c.status,
    at: now,
    read: false,
  }));
  if (added.length) save([...added, ...getNotifications()]);
  return added;
}

export function markAllRead(): void {
  save(getNotifications().map((n) => ({ ...n, read: true })));
}

export function unreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}
