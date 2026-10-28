"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";

import { cn, formatRelative } from "@/lib/utils";
import useNotifications from "@/hooks/useNotifications";
import { EmptyState, ListSkeleton } from "@/components/common/States";
import { AppNotification } from "@/types";

const GAP = 8;
const EDGE = 16;
const WIDTH = 352;

/** Where a notification opens in the app (entity-based routing, as in the commercial platform). */
const routeFor = (notification: AppNotification) =>
  notification.entityType === "shipment" && notification.entityId
    ? `/dashboard/shipments/${notification.entityId}`
    : null;

/**
 * Bell in the top bar: the latest notifications, newest first, with the
 * unread count on the bell. Closing the panel marks what was shown as read;
 * opening a notification marks just that one and goes to its shipment.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({});
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  const place = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(WIDTH, window.innerWidth - EDGE * 2);
    // Line up with the bell's right edge, but never run off the left of a phone screen.
    const right = Math.min(window.innerWidth - rect.right, window.innerWidth - EDGE - width);
    setPosition({ top: rect.bottom + GAP, right, width });
  }, []);

  const close = React.useCallback(
    ({ markAll = true, refocus = true } = {}) => {
      setOpen(false);
      if (markAll && unreadCount > 0) markAllAsRead();
      if (refocus) triggerRef.current?.focus();
    },
    [unreadCount, markAllAsRead],
  );

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        close({ refocus: false });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, close]);

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markAsRead(notification.id);
    close({ markAll: false, refocus: false });
    const route = routeFor(notification);
    if (route) router.push(route);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className="glass focus-ring relative flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-white/90 hover:text-ink"
      >
        <Bell className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        {unreadCount > 0 && (
          // Keyed on the count so a new notification replays the pop.
          <span
            key={unreadCount}
            aria-hidden
            className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] animate-pop-in items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold tabular-nums leading-none text-white ring-2 ring-canvas"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Notifications"
            tabIndex={-1}
            style={position}
            className="glass fixed z-[60] animate-pop-in overflow-hidden rounded-inset bg-white/95 focus:outline-none"
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-line/70 px-4 py-3">
              <p className="text-label font-semibold text-ink">Notifications</p>
              {unreadCount > 0 && <p className="text-caption text-ink-muted">{unreadCount} new</p>}
            </div>

            {isLoading ? (
              <ListSkeleton rows={3} />
            ) : notifications.length === 0 ? (
              <EmptyState
                compact
                icon={BellOff}
                title="No notifications yet"
                description="Updates on your shipments, like a driver setting off or arriving, appear here."
              />
            ) : (
              <ul className="scrollbar-thin max-h-[26rem] overflow-y-auto p-1.5">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={cn(
                        "focus-ring flex w-full gap-3 rounded-[0.625rem] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-sunken",
                        !notification.isRead && "bg-primary-50/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          notification.isRead ? "bg-line-strong" : "bg-primary-500",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-label text-ink", !notification.isRead && "font-semibold")}>
                          {notification.title}
                          {!notification.isRead && <span className="sr-only"> (unread)</span>}
                        </span>
                        {notification.content && (
                          <span className="mt-0.5 line-clamp-2 block text-caption text-ink-secondary">
                            {notification.content}
                          </span>
                        )}
                        <time dateTime={notification.createdAt} className="mt-1 block text-[0.6875rem] text-ink-muted">
                          {formatRelative(notification.createdAt)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
