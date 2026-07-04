import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/common/ui/components/badge";
import { Button } from "@/common/ui/components/button";
import { getTrackedOrders } from "../data/trackedOrders";
import { trackOrders } from "../data/orderTracking";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";
import TrackOrderForm from "./TrackOrderForm";

type LoadState = "loading" | "ok" | "error";

export default function MyOrdersPage() {
  const [views, setViews] = useState<TrackedOrderView[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    const tracked = getTrackedOrders();
    if (tracked.length === 0) { setViews([]); setState("ok"); return; }
    setState("loading");
    const res = await trackOrders(tracked.map((t) => ({ orderNumber: t.orderNumber, phone: t.phone })));
    if (res.type === "success") { setViews(res.data); setState("ok"); }
    else setState("error");
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>
      {state === "loading" ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          {state === "error" ? (
            <div className="mb-6 rounded-xl border bg-card p-6 text-center">
              <p className="text-muted-foreground">We couldn't load your orders.</p>
              <Button className="mt-4" onClick={() => load()}>Retry</Button>
            </div>
          ) : views.length === 0 ? (
            <div className="mb-6 rounded-xl border bg-card p-6 text-center">
              <p className="text-muted-foreground">You have no tracked orders yet.</p>
              <Button asChild className="mt-4"><Link to="/products">Shop now</Link></Button>
            </div>
          ) : (
            <ul className="mb-6 space-y-3">
              {views.map((v) => (
                <li key={v.orderNumber}>
                  <Link to={`/orders/${v.orderNumber}`} className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{v.orderNumber}</span>
                      <Badge variant="outline" className={`rounded-full border-transparent ${STATUS_META[v.status].badgeClass}`}>{STATUS_META[v.status].label}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                      <span className="font-semibold text-foreground">${v.total.toFixed(2)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <TrackOrderForm onAdded={load} />
        </>
      )}
    </div>
  );
}
