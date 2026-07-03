import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";
import { TrackedOrderView } from "./orderTypes";

export const trackOrders = (
  pairs: { orderNumber: string; phone: string }[],
): Promise<ApiResult<TrackedOrderView[]>> =>
  request<TrackedOrderView[]>({ url: "/api/orders/track", method: "POST", data: { orders: pairs } });
