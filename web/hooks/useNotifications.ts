"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useSocket } from "@/context/SocketContext";
import { AppNotification } from "@/types";

const ENDPOINT = "/api/v1/notifications";
const QUERY_KEY = ["notifications"];

const useNotifications = () => {
  const axiosAuth = useAxiosAuth();
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const { status } = useSession();

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    enabled: status === "authenticated",
    queryFn: async () =>
      (await axiosAuth.get(ENDPOINT)).data.data as { results: AppNotification[]; unreadCount: number },
    refetchInterval: connected ? false : 30_000,
  });

  useEffect(() => {
    if (!socket) return;

    const updateNotification = () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };

    socket.on("newNotification", updateNotification);

    return () => {
      socket.off("newNotification", updateNotification);
    };
  }, [socket, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => axiosAuth.patch(`${ENDPOINT}/read/${notificationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => axiosAuth.patch(`${ENDPOINT}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    notifications: data?.results ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isMarkingAll: markAllAsRead.isPending,
  };
};

export default useNotifications;
