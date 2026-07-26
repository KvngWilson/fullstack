import {
  Clock3,
  CreditCard,
  Package,
  RefreshCcw,
  Route,
  ShieldAlert,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Orders() {
  return (
    <ControlCenterPage
      badge="Admin • Orders"
      title="Order command center"
      description="Manage and review order workflows with full visibility into payment, fulfillment, and delivery exceptions."
      tags={["Queue health", "Payment confidence", "Fulfillment speed"]}
      actions={[
        { label: "Open shipping board", to: "/admin/shipping" },
        { label: "Support queue", to: "/admin/support" },
      ]}
      stats={[
        { label: "Orders today", value: "462", change: "+9% vs yesterday" },
        { label: "Awaiting payment", value: "23", change: "5 flagged for retry" },
        { label: "Needs fulfillment", value: "71", change: "12 at risk of SLA breach" },
        { label: "Refund requests", value: "14", change: "Average handling: 3h 12m" },
      ]}
      modules={[
        {
          icon: Clock3,
          title: "Throughput monitoring",
          description: "Track how quickly orders move from purchase to fulfillment.",
          items: ["Aging queue", "Order completion velocity", "SLA timers"],
        },
        {
          icon: CreditCard,
          title: "Payment assurance",
          description: "Detect and triage failed or ambiguous payment outcomes.",
          items: ["Retryable failures", "Gateway mismatches", "Duplicate charge checks"],
        },
        {
          icon: Package,
          title: "Fulfillment readiness",
          description: "Surface inventory and packaging dependencies before delays occur.",
          items: ["Stock blockers", "Pack/ship backlog", "Carrier handoff status"],
        },
        {
          icon: Route,
          title: "Delivery lifecycle",
          description: "Keep accurate customer visibility from dispatch to final delivery.",
          items: ["Tracking coverage", "In-transit exceptions", "Proof-of-delivery gaps"],
        },
        {
          icon: ShieldAlert,
          title: "Risk controls",
          description: "Proactively review suspicious patterns before they escalate.",
          items: ["Fraud indicators", "High-value order checks", "Manual review queue"],
        },
        {
          icon: RefreshCcw,
          title: "Recovery workflows",
          description: "Automate and guide remediation for interrupted order journeys.",
          items: ["Auto-retry rules", "Fallback routing", "Customer notifications"],
        },
      ]}
    />
  );
}
