import axios from "axios";

export const ACTIVE_ORG_COOKIE = "gobi_active_org";

const readActiveOrgId = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ACTIVE_ORG_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

const axiosAuth = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

axiosAuth.interceptors.request.use((request) => {
  const activeOrgId = readActiveOrgId();
  if (activeOrgId && !request.headers["x-organization-id"]) {
    request.headers["x-organization-id"] = activeOrgId;
  }
  return request;
});

export default axiosAuth;
