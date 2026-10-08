"use client";

import { useEffect } from "react";
import { getSession, signIn, useSession } from "next-auth/react";
import axiosAuth from "@/lib/axios";

const useAxiosAuth = () => {
  const { data: session } = useSession();

  useEffect(() => {
    const requestIntercept = axiosAuth.interceptors.request.use(
      async (config) => {
        if (!config.headers["Authorization"]) {
          const accessToken =
            session?.tokens?.accessToken ?? (await getSession())?.tokens?.accessToken;
          if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
          }
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
