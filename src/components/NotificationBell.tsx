"use client";

import { useState, useTransition } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";

export type NotificationItem = {
  id: number;
  message: string;
  createdAt: string;
  read: boolean;
};

export default function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.read).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      startTransition(() => {
        markNotificationsReadAction();
      });
    }
  }

  return (
    <div className="notif-wrap">
      <button className="notif-btn" onClick={toggle} aria-label="Notificações">
        🔔
        {unread > 0 && <span className="notif-count">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {notifications.length === 0 && (
            <div className="notif-item muted">Nenhuma notificação por enquanto.</div>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? "" : "unread"}`}>
              <div>{n.message}</div>
              <div className="when">{n.createdAt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
