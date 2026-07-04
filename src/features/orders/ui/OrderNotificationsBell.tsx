import { useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/common/ui/components/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/common/ui/components/drawer";
import { useMediaQuery } from "@/common/utils/useMediaQuery";
import { useOrderNotifications } from "../data/useOrderNotifications";
import { STATUS_META } from "../data/statusMeta";
import { OrderNotification } from "../data/notifications";

function NotificationList({
  notifications,
  onSelect,
}: {
  notifications: OrderNotification[];
  onSelect: (orderNumber: string) => void;
}) {
  if (notifications.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No updates yet.</p>;
  }
  return (
    <ul className="max-h-[60vh] divide-y overflow-y-auto sm:max-h-80">
      {notifications.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.orderNumber)}
            className="block w-full px-4 py-3 text-left text-sm hover:bg-accent/50"
          >
            <span className="font-medium">{n.orderNumber}</span> is now{" "}
            <span className="font-medium">{STATUS_META[n.status].label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {new Date(n.at).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function OrderNotificationsBell() {
  const { notifications, unreadCount, markAllRead } = useOrderNotifications();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [open, setOpen] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) markAllRead();
  };
  const select = (orderNumber: string) => {
    setOpen(false);
    navigate(`/orders/${orderNumber}`);
  };

  const trigger = (
    <Button variant="ghost" size="icon" className="relative" aria-label="Order notifications">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b px-4 py-3 text-sm font-semibold">Order updates</div>
          <NotificationList notifications={notifications} onSelect={select} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="border-b py-3 text-left">
          <DrawerTitle className="text-sm font-semibold">Order updates</DrawerTitle>
          <DrawerDescription className="sr-only">
            Recent status changes for the orders you're tracking
          </DrawerDescription>
        </DrawerHeader>
        <div className="pb-[env(safe-area-inset-bottom)]">
          <NotificationList notifications={notifications} onSelect={select} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
