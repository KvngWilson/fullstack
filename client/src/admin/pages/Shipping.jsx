import {
  PackageCheck,
  Route,
  ScanSearch,
  ShieldCheck,
  Timer,
  Truck,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Shipping() {
  return (
    <ControlCenterPage
      badge="Admin • Shipping"
      title="Shipment operations"
      description="Coordinate carrier workflows and warehouse output to keep deliveries on schedule."
      tags={["Carrier sync", "Tracking quality", "Warehouse flow"]}
      actions={[
        { label: "Back to orders", to: "/admin/orders" },
        { label: "Vendor view", to: "/admin/vendors" },
      ]}
      stats={[
        { label: "Dispatched today", value: "318", change: "+12% vs last week" },
        { label: "Pending labels", value: "27", change: "8 blocked by address validation" },
        { label: "Delivery exceptions", value: "11", change: "4 require manual outreach" },
        { label: "On-time delivery", value: "96.9%", change: "Within target range" },
      ]}
      modules={[
        {
          icon: Truck,
          title: "Carrier orchestration",
          description: "Balance volume and reliability across connected shipping partners.",
          items: ["Carrier utilization", "Rate optimization", "Fallback lane mapping"],
        },
        {
          icon: Route,
          title: "Transit visibility",
          description: "Maintain high-confidence tracking updates across every stage.",
          items: ["In-transit telemetry", "Stalled package detection", "ETA drift alerts"],
        },
        {
          icon: PackageCheck,
          title: "Warehouse readiness",
          description: "Keep picking and packing aligned with outbound promises.",
          items: ["Pack queue aging", "Pack accuracy trends", "Cutoff-time adherence"],
        },
        {
          icon: ScanSearch,
          title: "Address integrity",
          description: "Reduce failed deliveries with proactive validation and correction.",
          items: ["Undeliverable risk checks", "Postal normalization", "Manual correction queue"],
        },
        {
          icon: Timer,
          title: "SLA management",
          description: "Prioritize shipments by urgency to prevent service breaches.",
          items: ["Time-to-dispatch", "Expedite candidates", "Delayed order triage"],
        },
        {
          icon: ShieldCheck,
          title: "Operational controls",
          description: "Apply policy guardrails to protect consistency and auditability.",
          items: ["Override approvals", "Address change review", "Evidence logging"],
        },
      ]}
    />
  );
}
