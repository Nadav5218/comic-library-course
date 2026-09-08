import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Compass,
  Library,
  LogOut,
  Menu,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { UserNotification } from "@shared/api";
import { useAuth } from "@/hooks/useAuth";
import { safeInternalPath } from "@/lib/navigation";

export function AppHeader() {
  const { user, token, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/auth/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.data?.notifications || []);
      setUnread(data.data?.unread || 0);
    } catch {}
  };

  useEffect(() => {
    void loadNotifications();
    if (!token) return;
    const interval = window.setInterval(loadNotifications, 45_000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setNavigationOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAllRead = async () => {
    if (!token) return;
    await fetch("/api/auth/notifications/read-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnread(0);
  };

  const openNotification = async (notification: UserNotification) => {
    if (token && !notification.read) {
      void fetch(`/api/auth/notifications/${notification._id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnread((value) => Math.max(0, value - 1));
      setNotifications((items) =>
        items.map((item) =>
          item._id === notification._id ? { ...item, read: true } : item,
        ),
      );
    }
    setNotificationsOpen(false);
    if (notification.link) navigate(safeInternalPath(notification.link));
  };

  const closeNavigation = () => setNavigationOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f6f1e8]/92 backdrop-blur-xl">
      <div
        ref={rootRef}
        className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link to="/" className="group flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#3157d5] text-white shadow-lg shadow-blue-900/15 transition-transform group-hover:-rotate-3">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <div className="text-[15px] font-black tracking-[-0.035em] text-[#111827]">
              Comic Library
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7b8493]">
              Read. Collect. Continue.
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNavigationOpen((value) => !value);
                  setProfileOpen(false);
                  setNotificationsOpen(false);
                }}
                className="focus-ring flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 text-sm font-extrabold text-[#111827] transition hover:bg-white"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">Menu</span>
              </button>

              {navigationOpen && (
                <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-[22px] border border-black/10 bg-[#fffdf8] p-2 shadow-2xl">
                  <Link
                    to="/"
                    onClick={closeNavigation}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#344054] transition hover:bg-black/5"
                  >
                    <Compass className="h-4 w-4 text-[#3157d5]" />
                    Discover
                  </Link>

                  {!isAdmin && (
                    <>
                      <Link
                        to="/library"
                        onClick={closeNavigation}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#344054] transition hover:bg-black/5"
                      >
                        <Library className="h-4 w-4 text-[#2a9d8f]" />
                        My Library
                      </Link>
                      <Link
                        to="/my-requests"
                        onClick={closeNavigation}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#344054] transition hover:bg-black/5"
                      >
                        <ClipboardList className="h-4 w-4 text-[#7557d9]" />
                        Submissions
                      </Link>
                      <Link
                        to="/submit-request"
                        onClick={closeNavigation}
                        className="mt-1 flex items-center gap-3 rounded-xl bg-[#3157d5] px-3 py-3 text-sm font-extrabold text-white transition hover:bg-[#2849b8]"
                      >
                        <Send className="h-4 w-4" />
                        Submit material
                      </Link>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <Link
                        to="/requests"
                        onClick={closeNavigation}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#344054] transition hover:bg-black/5"
                      >
                        <ClipboardList className="h-4 w-4 text-[#7557d9]" />
                        Review Queue
                      </Link>
                      <Link
                        to="/add-comic"
                        onClick={closeNavigation}
                        className="mt-1 flex items-center gap-3 rounded-xl bg-[#2a9d8f] px-3 py-3 text-sm font-extrabold text-white transition hover:bg-[#23877a]"
                      >
                        <Plus className="h-4 w-4" />
                        Add comic
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {user ? (
            <>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => {
                    setNotificationsOpen((value) => !value);
                    setNavigationOpen(false);
                    setProfileOpen(false);
                    void loadNotifications();
                  }}
                  className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#111827] transition hover:bg-white"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#e65f5c] px-1 text-center text-[10px] font-black leading-4 text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-3 w-[min(92vw,380px)] overflow-hidden rounded-[22px] border border-black/10 bg-[#fffdf8] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
                      <div>
                        <div className="font-extrabold text-[#111827]">
                          Notifications
                        </div>
                        <div className="text-xs text-[#7b8493]">
                          {unread} unread
                        </div>
                      </div>
                      {unread > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs font-extrabold text-[#3157d5]"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-[#7b8493]">
                          Nothing new yet.
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification._id}
                            onClick={() => openNotification(notification)}
                            className={`block w-full border-b border-black/5 px-4 py-3 text-left transition hover:bg-black/[0.025] ${notification.read ? "" : "bg-blue-50/70"}`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-black/15" : "bg-[#3157d5]"}`}
                              />
                              <div>
                                <div className="text-sm font-extrabold text-[#111827]">
                                  {notification.title}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#667085]">
                                  {notification.message}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((value) => !value);
                    setNavigationOpen(false);
                    setNotificationsOpen(false);
                  }}
                  className="focus-ring flex items-center gap-2 rounded-full border border-black/10 bg-white/70 py-1.5 pl-1.5 pr-3 transition hover:bg-white"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${isAdmin ? "bg-[#7557d9]" : "bg-[#111827]"}`}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </div>
                  <div className="hidden max-w-[145px] text-left lg:block">
                    <div className="truncate text-xs font-extrabold text-[#111827]">
                      {user.username || user.email}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a93a1]">
                      {isAdmin ? "Administrator" : "Reader"}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-[#7b8493]" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-[20px] border border-black/10 bg-[#fffdf8] p-2 shadow-2xl">
                    <div className="border-b border-black/5 px-3 py-2.5">
                      <div className="truncate text-sm font-extrabold text-[#111827]">
                        {user.username || user.email}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[#8a93a1]">
                        {user.email}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        navigate("/");
                      }}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#c23d3a] hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
