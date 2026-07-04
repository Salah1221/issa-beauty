import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";

export type AuthUser = { email: string };

export const startRegistration = (email: string): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/register/start", method: "POST", data: { email } });
export const verifyCode = (email: string, code: string): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/register/verify", method: "POST", data: { email, code } });
export const completeRegistration = (email: string, code: string, password: string): Promise<ApiResult<AuthUser>> =>
  request({ url: "/api/auth/register/complete", method: "POST", data: { email, code, password } });
export const login = (email: string, password: string): Promise<ApiResult<AuthUser>> =>
  request({ url: "/api/auth/login", method: "POST", data: { email, password } });
export const logout = (): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/logout", method: "POST" });
export const getMe = (): Promise<ApiResult<AuthUser | null>> =>
  request({ url: "/api/auth/me", method: "GET" });
