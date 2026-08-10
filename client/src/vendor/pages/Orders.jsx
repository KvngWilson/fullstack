import {
  BadgeAlert,
  Clock3,
  PackageCheck,
  RefreshCcw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Orders() {
  return (
    <ControlCenterPage
      badge="Vendor • Orders"
      title="Order fulfillment queue"
      description="Stay on top of every customer order with clear fulfillment priorities, payment confidence, and delivery tracking."
      tags={["Fulfillment", "Order accuracy", "Customer trust"]}
      actions={[
        { label: "Inventory board", to: "/vendor/inventory" },
        { label: "View analytics", to: "/vendor/analytics" },
      ]}
      stats={[
        { label: "New orders", value: "38", change: "In the last 24 hours" },
        { label: "Ready to ship", value: "21", change: "7 expedited" },
        { label: "At-risk SLA", value: "5", change: "Requires immediate action" },
        { label: "Return requests", value: "4", change: "All within policy window" },
      ]}
      modules={[
        {
          icon: ShoppingCart,
          title: "Order intake",
          description: "Track incoming demand and quickly prioritize operational response.",
          items: ["Order source mix", "Rush-order detection", "Peak-time behavior"],
        },
        {
          icon: PackageCheck,
          title: "Fulfillment execution",
          description: "Move orders through pick, pack, and dispatch with fewer delays.",
          items: ["Packing backlog", "Pack error monitoring", "Dispatch readiness"],
        },
        {
          icon: Truck,
          title: "Delivery tracking",
          description: "Keep delivery promises visible and proactively handle exceptions.",
          items: ["In-transit visibility", "Delay alerts", "Carrier escalation flow"],
        },
        {
          icon: BadgeAlert,
          title: "Exception handling",
          description: "Resolve payment or address issues before they impact customers.",
          items: ["Payment discrepancies", "Address conflicts", "Fraud review handoff"],
        },
        {
          icon: RefreshCcw,
          title: "Post-purchase recovery",
          description: "Handle cancellations, refunds, and exchanges consistently.",
          items: ["Refund turnaround", "Restock automation", "Policy-safe reversals"],
        },
        {
          icon: Clock3,
          title: "SLA timing",
          description: "Prioritize by deadlines to protect customer experience.",
          items: ["Aging orders", "Fulfillment timers", "Late risk prevention"],
        },
      ]}
    />
  );
}
