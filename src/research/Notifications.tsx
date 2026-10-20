import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "../components/ui";
import { supabase } from "../lib/supabase";
import {
  categories,
  operate,
  rows,
  type Notification,
  type Preference,
} from "./model";
import "./research.css";
export function useNotifications(w: string, user: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", w, user],
    enabled: !!w && !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      await operate(w, "deadline_refresh", {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      return {
        notifications: (await rows<Notification>("rf_notifications", w)).sort(
          (a, b) => b.created_at.localeCompare(a.created_at),
        ),
        preferences: await rows<Preference>("rf_notification_preferences", w),
      };
    },
  });
  useEffect(() => {
    if (!w || !user) return;
    const refresh = () =>
      void client.invalidateQueries({ queryKey: ["notifications", w, user] });
    const channel = supabase
      .channel(`rf-notifications-${w}-${user}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rf_notifications",
          filter: `user_id=eq.${user}`,
        },
        refresh,
      )
      .on("system", "*", refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [w, user, client]);
  async function action(name: string, p: Record<string, unknown> = {}) {
    await operate(w, name, p);
    await client.invalidateQueries({ queryKey: ["notifications", w, user] });
  }
  return { ...query, action };
}
export function NotificationBell({
  workspace,
  user,
}: {
  workspace: string;
  user: string;
}) {
  const q = useNotifications(workspace, user);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const unread = q.data?.notifications.filter((n) => !n.read_at) || [];
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <>
      <button
        className="icon-button notification-bell"
        aria-label={`Notifications, ${unread.length} unread`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        <span>{unread.length}</span>
      </button>
      {open && (
        <div
          className="research-card notification-menu"
          role="region"
          aria-label="Notification dropdown"
        >
          <div className="research-toolbar">
            <strong>Notifications</strong>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          {q.isPending ? (
            <p>Loading…</p>
          ) : q.error ? (
            <p role="alert">{q.error.message}</p>
          ) : (
            <>
              <small>
                In-app delivery · refreshes every 30 seconds, with Realtime when
                connected.
              </small>
              {error && <p role="alert">{error}</p>}
              <ul className="research-list">
                {unread.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <Link
                      to={
                        n.destination.startsWith("/") &&
                        !n.destination.startsWith("//")
                          ? n.destination
                          : "/notifications"
                      }
                      onClick={() => {
                        setOpen(false);
                        void q
                          .action("notifications_read", { id: n.id })
                          .catch((e) => setError(String(e)));
                      }}
                    >
                      {n.message}
                    </Link>
                    <small>{new Date(n.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
              {!unread.length && <p>You’re all caught up.</p>}
              <Link to="/notifications" onClick={() => setOpen(false)}>
                View all notifications & preferences
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}
export default function Notifications({
  workspace,
  user,
}: {
  workspace: string;
  user: string;
}) {
  const q = useNotifications(workspace, user);
  const [error, setError] = useState("");
  const run = (name: string, p: Record<string, unknown> = {}) => {
    setError("");
    void q
      .action(name, p)
      .catch((e) => setError(e instanceof Error ? e.message : "Update failed"));
  };
  return (
    <>
      <div className="research-toolbar">
        <h2>Notification center</h2>
        <Button onClick={() => run("notifications_read")}>
          Mark all as read
        </Button>
      </div>
      <p className="research-notice">
        In-app notifications only. Deadline notices are reconciled while the app
        is open; no email, SMS or browser push is sent. Messages contain generic
        event summaries to protect private research details.
      </p>
      {(error || q.error) && <p role="alert">{error || q.error?.message}</p>}
      <section className="research-card">
        <h3>Preferences</h3>
        <div className="research-grid">
          {categories.map((cat) => (
            <label key={cat}>
              <input
                type="checkbox"
                checked={
                  q.data?.preferences.find((p) => p.category === cat)
                    ?.enabled !== false
                }
                onChange={(e) =>
                  run("preference", {
                    category: cat,
                    enabled: e.target.checked,
                  })
                }
              />{" "}
              {cat}
            </label>
          ))}
        </div>
        <small>
          Preferences affect future notifications; existing entries are
          retained.
        </small>
      </section>
      <ul className="research-list">
        {q.data?.notifications.map((n) => (
          <li key={n.id}>
            <strong>
              {n.read_at ? "Read" : "Unread"} · {n.category}
            </strong>
            <p>{n.message}</p>
            <small>{new Date(n.created_at).toLocaleString()}</small>
            <div className="research-toolbar">
              <Link
                to={
                  n.destination.startsWith("/") &&
                  !n.destination.startsWith("//")
                    ? n.destination
                    : "/notifications"
                }
              >
                Open workspace record
              </Link>
              {!n.read_at && (
                <Button
                  variant="ghost"
                  onClick={() => run("notifications_read", { id: n.id })}
                >
                  Mark as read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {q.data && !q.data.notifications.length && <p>No notifications yet.</p>}
    </>
  );
}
