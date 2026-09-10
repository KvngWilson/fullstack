import {
  AlarmClockCheck,
  BarChart4,
  Boxes,
  PackageMinus,
  ScanLine,
  Warehouse,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Inventory() {
  return (
    <ControlCenterPage
      badge="Vendor • Inventory"
      title="Inventory command board"
      description="Control stock levels with proactive alerts, accurate variant tracking, and replenishment intelligence."
      tags={["Stock confidence", "Replenishment", "Accuracy"]}
      actions={[
        { label: "Manage products", to: "/vendor/products" },
        { label: "Order queue", to: "/vendor/orders" },
      ]}
      stats={[
        {
          label: "Total units",
          value: "24,180",
          change: "Across all active variants",
        },
        {
          label: "Low stock SKUs",
          value: "14",
          change: "3 critical restock now",
        },
        {
          label: "Out of stock",
          value: "6",
          change: "Improved from 11 last week",
        },
        {
          label: "Inventory accuracy",
          value: "99.1%",
          change: "Cycle-count verified",
        },
      ]}
      modules={[
        {
          icon: Warehouse,
          title: "Stock position",
          description:
            "Track current availability by product, variant, and fulfillment priority.",
          items: [
            "Real-time stock map",
            "Variant depth visibility",
            "Location-level overview",
          ],
        },
        {
          icon: PackageMinus,
          title: "Stockout prevention",
          description:
            "Identify depletion risks before they affect conversion.",
          items: [
            "At-risk SKU alerts",
            "Velocity-based forecasting",
            "Restock urgency scoring",
          ],
        },
        {
          icon: ScanLine,
          title: "Inventory accuracy",
          description:
            "Improve confidence with tighter controls and discrepancy detection.",
          items: [
            "Count mismatch detection",
            "Adjustment audit trail",
            "Anomaly alerts",
          ],
        },
        {
          icon: Boxes,
          title: "Allocation planning",
          description:
            "Balance stock across fast movers, promotions, and upcoming campaigns.",
          items: [
            "Campaign allocation",
            "Seasonal reserve planning",
            "Slow-moving optimization",
          ],
        },
        {
          icon: AlarmClockCheck,
          title: "Replenishment cadence",
          description:
            "Coordinate restocks with lead-time awareness and demand signals.",
          items: [
            "Supplier lead-time health",
            "PO readiness",
            "Reorder point checks",
          ],
        },
        {
          icon: BarChart4,
          title: "Inventory analytics",
          description:
            "Measure stock efficiency and identify opportunities to improve turns.",
          items: [
            "Sell-through rate",
            "Days of cover",
            "Aged inventory trends",
          ],
        },
      ]}
    />
  );
}
