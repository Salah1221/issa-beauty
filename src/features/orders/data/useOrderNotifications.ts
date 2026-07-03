import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getTrackedOrders, setLastSeenStatus } from "./trackedOrders";
import { trackOrders } from "./orderTracking";
import { diffStatuses, addNotifications, getNotifications, markAllRead as markAllReadStore, unreadCount as unreadCountStore, OrderNotification } from "./notifications";
import { STATUS_META } from "./statusMeta";

const POLL_MS = 60_000;

export function useOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>(getNotifications());
  const [unread, setUnread] = useState<number>(unreadCountStore());

  const sync = useCallback(() => {
    setNotifications(getNotifications());
    setUnread(unreadCountStore());
  }, []);

  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const tracked = getTrackedOrders();
      if (tracked.length === 0) return;
      const res = await trackOrders(tracked.map((t) => ({ orderNumber: t.orderNumber, phone: t.phone })));
      if (res.type !== "success") return; // swallow poll errors, keep last-known state
      const changes = diffStatuses(tracked, res.data);
      if (changes.length === 0) return;
      const added = addNotifications(changes);
      changes.forEach((c) => setLastSeenStatus(c.orderNumber, c.status));
      added.forEach((n) =>
        toast(`Order ${n.orderNumber} is now ${STATUS_META[n.status].label}`),
      );
      sync();
    } finally {
      inFlight.current = false;
    }
  }, [sync]);

  const markAllRead = useCallback(() => {
    markAllReadStore();
    sync();
  }, [sync]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { notifications, unreadCount: unread, markAllRead, refresh };
}
