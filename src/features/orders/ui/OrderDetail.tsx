import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/common/ui/components/badge";
import { Button } from "@/common/ui/components/button";
import { getTrackedOrders, removeTrackedOrder } from "../data/trackedOrders";
import { trackOrders } from "../data/orderTracking";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";
import { StatusStepper } from "./StatusStepper";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<TrackedOrderView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    const tracked = getTrackedOrders().find((t) => t.orderNumber === orderNumber);
    if (!tracked) { setState("missing"); return; }
    trackOrders([{ orderNumber: tracked.orderNumber, phone: tracked.phone }]).then((res) => {
      if (res.type === "success" && res.data.length === 1) { setView(res.data[0]); setState("ok"); }
      else setState("missing");
    });
  }, [orderNumber]);

  if (state === "loading") return <div className="mx-auto max-w-2xl px-4 py-8"><p className="text-muted-foreground">Loading…</p></div>;
  if (state === "missing" || !view)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">We couldn't load that order.</p>
        <Button asChild className="mt-4"><Link to="/orders">Back to my orders</Link></Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="text-sm text-muted-foreground hover:underline">← My Orders</Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{view.orderNumber}</h1>
        <Badge variant="outline" className={`rounded-full border-transparent ${STATUS_META[view.status].badgeClass}`}>{STATUS_META[view.status].label}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {view.itemCount} {view.itemCount === 1 ? "item" : "items"} · ${view.total.toFixed(2)} · updated {new Date(view.updatedAt).toLocaleString()}
      </p>
      <div className="mt-6 rounded-xl border bg-card p-6"><StatusStepper status={view.status} /></div>
      <Button variant="ghost" className="mt-6 text-red-600" onClick={() => { removeTrackedOrder(view.orderNumber); navigate("/orders"); }}>
        Stop tracking this order
      </Button>
    </div>
  );
}
