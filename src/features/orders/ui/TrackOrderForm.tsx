import { useState } from "react";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { trackOrders } from "../data/orderTracking";
import { addTrackedOrder } from "../data/trackedOrders";

export default function TrackOrderForm({ onAdded }: { onAdded: () => void }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await trackOrders([{ orderNumber: orderNumber.trim(), phone: phone.trim() }]);
    setLoading(false);
    if (res.type === "success" && res.data.length === 1) {
      addTrackedOrder({ orderNumber: res.data[0].orderNumber, phone: phone.trim(), status: res.data[0].status });
      setOrderNumber(""); setPhone("");
      onAdded();
    } else {
      setError("We couldn't find an order with that number and phone.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Track another order</h2>
      <Input placeholder="Order number (e.g. IB-7QX2M9)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
      <Input placeholder="Phone used at checkout" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Checking…" : "Track order"}</Button>
    </form>
  );
}
