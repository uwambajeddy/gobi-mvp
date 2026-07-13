"use client";

import { useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import axiosAuth from "@/lib/axios";

/**
 * Returns the shared Axios instance with the session access token attached.
 * NextAuth's jwt callback keeps the access token fresh (refresh-token flow),
 * so a 401 here means the session is truly gone → redirect to sign-in.
 */
const useAxiosAuth = () => {
  const { data: session } = useSession();

  useEffect(() => {
    const requestIntercept = axiosAuth.interceptors.request.use(
      (config) => {
        if (!config.headers["Authorization"] && session?.tokens?.accessToken) {
          config.headers["Authorization"] = `Bearer ${session.tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    const responseIntercept = axiosAuth.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error?.response?.status === 401) {
          await signIn();
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axiosAuth.interceptors.request.eject(requestIntercept);
      axiosAuth.interceptors.response.eject(responseIntercept);
    };
  }, [session]);

  return axiosAuth;
};

export default useAxiosAuth;
