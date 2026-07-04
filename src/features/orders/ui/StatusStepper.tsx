import { Check } from "lucide-react";
import { OrderStatus } from "../data/orderTypes";
import { STATUS_META, STEP_FLOW } from "../data/statusMeta";

export function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
        This order was cancelled.
      </div>
    );
  }
  const currentIndex = STEP_FLOW.indexOf(status);
  return (
    <ol className="space-y-4">
      {STEP_FLOW.map((step, i) => {
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm ${isCurrent ? "font-semibold" : done ? "text-foreground" : "text-muted-foreground"}`}>
              {STATUS_META[step].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
