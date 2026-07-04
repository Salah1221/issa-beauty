import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { Button } from "@/common/ui/components/button";
import { type PlacedOrder } from "@/features/checkout/data/orders";

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("lastOrder");
    if (!raw) {
      navigate("/", { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PlacedOrder;
      setOrder(parsed);
    } catch {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  if (!order) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">Order placed!</h1>
        <p className="mt-1 text-muted-foreground">
          Your order number is{" "}
          <span className="font-semibold text-foreground">{order.orderNumber}</span>.
          We'll contact you to confirm delivery (cash on delivery).
        </p>
      </div>

      <div className="mt-8 rounded-xl border bg-card shadow-sm p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Order summary
        </h2>
        <div className="divide-y">
          {order.items.map((i) => (
            <div key={i.productId} className="flex justify-between py-2 text-sm">
              <span className="pr-2">
                {i.name} × {i.quantity}
              </span>
              <span className="font-medium">${i.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>${order.deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card shadow-sm p-6 text-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Delivery details
        </h2>
        <p>{order.customer.fullName}</p>
        <p>{order.customer.phone}</p>
        {order.customer.email && <p>{order.customer.email}</p>}
        <p className="mt-2">
          {order.shipping.address}
          {order.shipping.area ? `, ${order.shipping.area}` : ""}, {order.shipping.city}
        </p>
        {order.shipping.notes && (
          <p className="mt-1 text-muted-foreground">Notes: {order.shipping.notes}</p>
        )}
      </div>

      <Button asChild variant="outline" className="mt-8 w-full">
        <Link to={`/orders/${order.orderNumber}`}>Track your order</Link>
      </Button>

      <Button asChild className="mt-8 w-full">
        <Link to="/products">Continue shopping</Link>
      </Button>
    </div>
  );
}
