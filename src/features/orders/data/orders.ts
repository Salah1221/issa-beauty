import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";
import { TrackedOrderView } from "./orderTypes";

export const getMyOrders = (): Promise<ApiResult<TrackedOrderView[]>> =>
  request<TrackedOrderView[]>({ url: "/api/orders/mine", method: "GET" });
