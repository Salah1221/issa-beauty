import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMyOrders } from "./orders";
import { useAuth } from "@/features/auth/data/AuthContext";
import {
  diffStatuses, addNotifications, getNotifications, getLastSeen, setLastSeen,
  markAllRead as markAllReadStore, unreadCount as unreadCountStore, OrderNotification,
} from "./notifications";
import { STATUS_META } from "./statusMeta";

const POLL_MS = 60_000;

export function useOrderNotifications() {
  const { user } = useAuth();
  const userKey = user?.email ?? "";
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const inFlight = useRef(false);

  const sync = useCallback(() => {
    setNotifications(userKey ? getNotifications(userKey) : []);
    setUnread(userKey ? unreadCountStore(userKey) : 0);
  }, [userKey]);

  const refresh = useCallback(async () => {
    if (!userKey || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getMyOrders();
      if (res.type !== "success") return;
      const views = res.data;
      const lastSeen = getLastSeen(userKey);
      const changes = diffStatuses(lastSeen, views);
      const next = { ...lastSeen };
      for (const v of views) next[v.orderNumber] = v.status;
      setLastSeen(userKey, next);
      if (changes.length) {
        const added = addNotifications(userKey, changes);
        added.forEach((n) => toast(`Order ${n.orderNumber} is now ${STATUS_META[n.status].label}`));
      }
      sync();
    } finally {
      inFlight.current = false;
    }
  }, [userKey, sync]);

  const markAllRead = useCallback(() => {
    if (userKey) { markAllReadStore(userKey); sync(); }
  }, [userKey, sync]);

  useEffect(() => {
    sync();
    if (!userKey) return;
    refresh();
    const id = window.setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [userKey, refresh, sync]);

  return { notifications, unreadCount: unread, markAllRead, refresh };
}
