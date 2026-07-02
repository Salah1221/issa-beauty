import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  isAxiosError,
  isCancel,
} from "axios";
import { ApiResult } from "./ApiResult";

const apiClient: AxiosInstance = axios.create({
  // In production this points at the standalone backend (api.issabeauty.org).
  // In dev it's undefined, so requests stay relative and hit the Vite proxy.
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// The server wraps every response in { success, data, message? }. `request`
// unwraps that envelope into an ApiResult so callers never touch axios or the
// envelope directly. Pass `select` when the payload lives outside `data`
// (e.g. paginated endpoints that return `pages` alongside `data`).
export async function request<T>(
  config: AxiosRequestConfig,
  select?: (body: ApiEnvelope) => T,
): Promise<ApiResult<T>> {
  try {
    const response = await apiClient.request<ApiEnvelope>(config);
    const body = response.data;
    if (!body.success) {
      return {
        type: "error",
        message: body.message ?? "Request failed",
        code: response.status,
      };
    }
    return { type: "success", data: select ? select(body) : (body.data as T) };
  } catch (error) {
    if (isCancel(error)) {
      return { type: "canceled" };
    }
    if (isAxiosError(error)) {
      return {
        type: "error",
        message: error.response?.data?.message ?? error.message,
        code: error.response?.status,
      };
    }
    return { type: "error", message: "Unexpected error" };
  }
}

type ApiEnvelope = {
  success: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

export default apiClient;
