import { useEffect } from "react";
import { useWebSocket } from "@/app/providers/WebSocketProvider";

export default function useOrderRealtime(orderIds, onStatusChange) {
  const { subscribeToOrder } = useWebSocket();

  useEffect(() => {
    const normalizedIds = (Array.isArray(orderIds) ? orderIds : [orderIds])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    if (normalizedIds.length === 0 || typeof onStatusChange !== "function") {
      return undefined;
    }

    const unsubscribers = normalizedIds.map((orderId) =>
      subscribeToOrder(orderId, onStatusChange),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [onStatusChange, orderIds, subscribeToOrder]);
}
