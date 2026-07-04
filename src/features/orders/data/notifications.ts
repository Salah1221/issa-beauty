import { OrderStatus, TrackedOrderView } from "./orderTypes";

const NOTES_PREFIX = "issa.orderNotifications.";
const SEEN_PREFIX = "issa.orderLastSeen.";
let seq = 0;

export type OrderNotification = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  at: string;
  read: boolean;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getLastSeen(userKey: string): Record<string, OrderStatus> {
  const v = readJson<Record<string, OrderStatus>>(SEEN_PREFIX + userKey, {});
  return v && typeof v === "object" ? v : {};
}
export function setLastSeen(userKey: string, map: Record<string, OrderStatus>): void {
  localStorage.setItem(SEEN_PREFIX + userKey, JSON.stringify(map));
}

export function diffStatuses(
  lastSeen: Record<string, OrderStatus>,
  views: TrackedOrderView[],
): { orderNumber: string; status: OrderStatus }[] {
  const changes: { orderNumber: string; status: OrderStatus }[] = [];
  for (const v of views) {
    if (v.orderNumber in lastSeen && lastSeen[v.orderNumber] !== v.status) {
      changes.push({ orderNumber: v.orderNumber, status: v.status });
    }
  }
  return changes;
}

export function getNotifications(userKey: string): OrderNotification[] {
  const v = readJson<OrderNotification[]>(NOTES_PREFIX + userKey, []);
  return Array.isArray(v) ? v : [];
}
function saveNotifications(userKey: string, n: OrderNotification[]): void {
  localStorage.setItem(NOTES_PREFIX + userKey, JSON.stringify(n));
}
export function addNotifications(
  userKey: string,
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
  if (added.length) saveNotifications(userKey, [...added, ...getNotifications(userKey)].slice(0, 50));
  return added;
}
export function markAllRead(userKey: string): void {
  saveNotifications(userKey, getNotifications(userKey).map((n) => ({ ...n, read: true })));
}
export function unreadCount(userKey: string): number {
  return getNotifications(userKey).filter((n) => !n.read).length;
}
