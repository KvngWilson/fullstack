import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { ADMIN_ROLES } from "@/api/types/user";
import {
  selectAuthIsHydrated,
  selectIsAuthenticated,
  selectUser,
} from "@/features/auth/authSelectors";
import { useAppSelector } from "@/store";
import { notifyError, notifyInfo } from "@/utils/toast";

const WebSocketContext = createContext(null);
const SOCKET_URL = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const SOCKET_PATH = "/socket.io/";
const GUEST_ID_KEY = "websocket.guest.id";

function getOrCreateGuestId() {
  if (typeof window === "undefined") {
    return "guest";
  }

  const stored = window.localStorage.getItem(GUEST_ID_KEY);
  if (stored) {
    return stored;
  }

  const guestId =
    window.crypto?.randomUUID?.() ||
    `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(GUEST_ID_KEY, guestId);
  return guestId;
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function WebSocketProvider({ children }) {
  const isHydrated = useAppSelector(selectAuthIsHydrated);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const orderListenersRef = useRef(new Map());
  const adminListenersRef = useRef(new Set());
  const subscribedOrderIdsRef = useRef(new Set());

  const emitRoomSubscriptions = useCallback(
    (socket) => {
      subscribedOrderIdsRef.current.forEach((orderId) => {
        socket.emit("subscribe:order", orderId, (ack) => {
          if (ack?.error) {
            notifyError(ack.error);
          }
        });
      });

      if (isAuthenticated && isAdminRole(user?.role)) {
        socket.emit("subscribe:admin-dashboard", (ack) => {
          if (ack?.error) {
            notifyError(ack.error);
          }
        });
      }
    },
    [isAuthenticated, user?.role],
  );

  const subscribeToOrder = useCallback((orderId, listener) => {
    const normalizedOrderId = Number(orderId);
    if (!Number.isFinite(normalizedOrderId) || typeof listener !== "function") {
      return () => {};
    }

    const key = String(normalizedOrderId);
    let listeners = orderListenersRef.current.get(key);
    if (!listeners) {
      listeners = new Set();
      orderListenersRef.current.set(key, listeners);
    }
    listeners.add(listener);
    subscribedOrderIdsRef.current.add(key);

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("subscribe:order", key, (ack) => {
        if (ack?.error) {
          notifyError(ack.error);
        }
      });
    }

    return () => {
      const currentListeners = orderListenersRef.current.get(key);
      if (currentListeners) {
        currentListeners.delete(listener);
        if (currentListeners.size === 0) {
          orderListenersRef.current.delete(key);
          subscribedOrderIdsRef.current.delete(key);
          if (socketRef.current?.connected) {
            socketRef.current.emit("unsubscribe:order", key, () => {});
          }
        }
      }
    };
  }, []);

  const subscribeToAdminDashboard = useCallback(
    (listener) => {
      if (typeof listener !== "function") {
        return () => {};
      }

      adminListenersRef.current.add(listener);

      const socket = socketRef.current;
      if (socket?.connected && isAuthenticated && isAdminRole(user?.role)) {
        socket.emit("subscribe:admin-dashboard", (ack) => {
          if (ack?.error) {
            notifyError(ack.error);
          }
        });
      }

      return () => {
        adminListenersRef.current.delete(listener);
      };
    },
    [isAuthenticated, user?.role],
  );

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: false,
      ...(isAuthenticated ? {} : { auth: { guestId: getOrCreateGuestId() } }),
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      emitRoomSubscriptions(socket);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleOrderStatusUpdated = (payload) => {
      const listeners = orderListenersRef.current.get(String(payload?.orderId));
      if (!listeners) {
        return;
      }

      listeners.forEach((listener) => listener(payload));
    };

    const handleAdminOrderStatusChanged = (payload) => {
      adminListenersRef.current.forEach((listener) => listener(payload));
      if (payload?.orderId) {
        notifyInfo(`Order #${payload.orderId} updated to ${payload.newStatus}`);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("order:status-updated", handleOrderStatusUpdated);
    socket.on("admin:order-status-changed", handleAdminOrderStatusChanged);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("order:status-updated", handleOrderStatusUpdated);
      socket.off("admin:order-status-changed", handleAdminOrderStatusChanged);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [emitRoomSubscriptions, isAuthenticated, isHydrated, user?.role]);

  const value = useMemo(
    () => ({
      socket: socketRef.current,
      connected,
      subscribeToOrder,
      subscribeToAdminDashboard,
    }),
    [connected, subscribeToAdminDashboard, subscribeToOrder],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }

  return context;
}
