export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];

export type TrackedOrderView = {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};
