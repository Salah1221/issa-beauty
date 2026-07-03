export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];

export type TrackedOrder = {
  orderNumber: string;
  phone: string;
  lastSeenStatus: OrderStatus;
  addedAt: string;
};

export type TrackedOrderView = {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};
