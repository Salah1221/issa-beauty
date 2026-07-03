import { OrderStatus } from "./orderTypes";

export const STATUS_META: Record<OrderStatus, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-100 text-blue-800" },
  delivered: { label: "Delivered", badgeClass: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", badgeClass: "bg-red-100 text-red-800" },
};

// The happy-path flow shown as a stepper; "cancelled" is a terminal state, not a step.
export const STEP_FLOW: OrderStatus[] = ["pending", "confirmed", "delivered"];
