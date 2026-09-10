import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  ShoppingBag,
  Users,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Dashboard() {
  return (
    <ControlCenterPage
      badge="Vendor Workspace"
      title="Grow your store with clarity"
      description="Track sales momentum, monitor order flow, and manage catalog performance from one modern workspace."
      tags={["Daily performance", "Catalog health", "Order execution"]}
      actions={[
        { label: "Manage products", to: "/vendor/products" },
        { label: "Open analytics", to: "/vendor/analytics" },
      ]}
      stats={[
        { label: "Revenue today", value: "$8.4k", change: "+11% vs yesterday" },
        {
          label: "Open orders",
          value: "52",
          change: "9 need same-day handling",
        },
        { label: "Low-stock SKUs", value: "14", change: "3 critical" },
        {
          label: "Repeat customers",
          value: "38%",
          change: "Strong retention trend",
        },
      ]}
      modules={[
        {
          icon: CircleDollarSign,
          title: "Revenue pulse",
          description:
            "Monitor daily sales with clear trend visibility and conversion context.",
          items: ["Sales velocity", "Top-selling lines", "Margin sensitivity"],
        },
        {
          icon: ShoppingBag,
          title: "Order operations",
          description:
            "Stay ahead of fulfillment priorities and customer expectations.",
          items: [
            "Pending fulfillment",
            "Cancellation signals",
            "Delivery confidence",
          ],
        },
        {
          icon: Boxes,
          title: "Inventory confidence",
          description: "Reduce stockouts and improve replenishment timing.",
          items: [
            "Low-stock alerts",
            "Demand forecasting",
            "Slow-mover detection",
          ],
        },
        {
          icon: BarChart3,
          title: "Performance insights",
          description:
            "Understand what drives growth and where to optimize next.",
          items: ["Category performance", "Basket behavior", "Promo impact"],
        },
        {
          icon: Users,
          title: "Customer intelligence",
          description:
            "Build stronger retention with visibility into buying behavior.",
          items: [
            "Returning customer mix",
            "Lifecycle stage",
            "Satisfaction indicators",
          ],
        },
        {
          icon: Clock3,
          title: "Execution speed",
          description:
            "Keep internal operations aligned with service-level goals.",
          items: [
            "Pick/pack timing",
            "Response latency",
            "Operational bottlenecks",
          ],
        },
      ]}
    />
  );
}
