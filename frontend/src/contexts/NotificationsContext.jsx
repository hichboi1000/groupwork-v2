import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getNotifications, markRead as apiMarkRead, markAllRead as apiMarkAllRead } from "../api/client";

// Same host as the REST API (see api/client.js), just swapped to the ws:// scheme.
// Set VITE_WS_BASE_URL in frontend/.env for LAN/phone testing or production
// (use wss:// in production).
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000") + "/ws/notifications/";

// Only used as a safety net while the socket is disconnected/reconnecting —
// the WebSocket is the primary channel now, this is just a fallback.
const FALLBACK_POLL_INTERVAL_MS = 15000;
const MAX_RECONNECT_DELAY_MS = 15000;

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const pollTimerRef = useRef(null);
  const notificationsRef = useRef([]);
  notificationsRef.current = notifications;

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getNotifications();
      setNotifications(res.data);
    } catch {
      // leave existing state as-is; next successful refresh/push will fix it
    } finally {
      setLoading(false);
    }
  }, [user]);

  const upsertNotification = (n) => {
    setNotifications((prev) => {
      if (prev.some((existing) => existing.id === n.id)) {
        return prev.map((existing) => (existing.id === n.id ? n : existing));
      }
      return [n, ...prev];
    });
  };

  const connectSocket = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const socket = new WebSocket(`${WS_BASE_URL}?token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      reconnectAttemptRef.current = 0;
      // Socket is live — stop the fallback poller.
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "notification.new" && data.notification) {
          upsertNotification(data.notification);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    socket.onclose = () => {
      setConnected(false);
      socketRef.current = null;
      // Start (or keep running) the fallback poller while we're down.
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(refresh, FALLBACK_POLL_INTERVAL_MS);
      }
      // Reconnect with a capped backoff — no point hammering the server.
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, MAX_RECONNECT_DELAY_MS);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(connectSocket, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [user, refresh]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      setConnected(false);
      return;
    }

    refresh();
    connectSocket();

    // Reconnect immediately when the tab regains focus, in case the
    // socket quietly died while backgrounded (mobile browsers do this).
    const onFocus = () => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        connectSocket();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user, connectSocket, refresh]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markOneRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await apiMarkRead(id);
    } catch {
      refresh();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await apiMarkAllRead();
    } catch {
      refresh();
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        connected,
        refresh,
        markOneRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used inside NotificationsProvider");
  }
  return ctx;
}
