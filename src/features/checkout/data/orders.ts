import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";

// Display-only mirror of the server's authoritative delivery fee.
export const DELIVERY_FEE = 3;

export type OrderItemInput = { productId: string; quantity: number };
export type CustomerInput = { fullName: string; phone: string; email?: string };
export type ShippingInput = {
  address: string;
  city: string;
  area?: string;
  notes?: string;
};
export type PlaceOrderInput = {
  items: OrderItemInput[];
  customer: CustomerInput;
  shipping: ShippingInput;
};

export type PlacedOrderItem = {
  productId: string;
  name: string;
  unitPrice: number;
  discountPercentage: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
};

export type PlacedOrder = {
  orderNumber: string;
  items: PlacedOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customer: CustomerInput;
  shipping: ShippingInput;
  paymentMethod: string;
  status: string;
  createdAt: string;
};

export const placeOrder = (
  input: PlaceOrderInput,
): Promise<ApiResult<PlacedOrder>> =>
  request<PlacedOrder>({ url: "/api/orders", method: "POST", data: input });
