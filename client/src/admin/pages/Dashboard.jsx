import {
  Activity,
  AlertCircle,
  PackageCheck,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Dashboard() {
  return (
    <ControlCenterPage
      badge="Admin Control Center"
      title="Platform operations at a glance"
      description="Monitor platform activity, track critical workflows, and coordinate operations across vendors, orders, and user management."
      tags={["Role-aware access", "Live operations", "System health"]}
      actions={[
        { label: "Review orders", to: "/admin/orders" },
        { label: "Manage users", to: "/admin/users" },
      ]}
      stats={[
        { label: "Open incidents", value: "3", change: "Down 40% this week" },
        { label: "Pending orders", value: "128", change: "17 need immediate attention" },
        { label: "Active vendors", value: "94", change: "+6 onboarded this month" },
        { label: "SLA compliance", value: "98.4%", change: "Ahead of target" },
      ]}
      modules={[
        {
          icon: Activity,
          title: "Operations pulse",
          description: "Track incoming volume and bottlenecks to keep fulfillment moving.",
          items: ["Queue pressure", "Escalation trends", "Real-time service status"],
        },
        {
          icon: PackageCheck,
          title: "Order lifecycle",
          description: "Maintain smooth transitions across payment, fulfillment, and delivery.",
          items: ["Stuck order detection", "Shipment timing", "Refund exceptions"],
        },
        {
          icon: Store,
          title: "Vendor oversight",
          description: "Ensure catalog quality and merchant performance across the marketplace.",
          items: ["Vendor growth", "Catalog accuracy", "Dispute monitoring"],
        },
        {
          icon: ShieldCheck,
          title: "Security and policy",
          description: "Enforce access controls and review policy-sensitive events.",
          items: ["Permission audits", "Suspicious activity", "Compliance checks"],
        },
        {
          icon: Users,
          title: "Team coordination",
          description: "Align support, operations, and admin teams around daily priorities.",
          items: ["Ownership routing", "Cross-team handoffs", "Capacity balancing"],
        },
        {
          icon: AlertCircle,
          title: "Priority watchlist",
          description: "Keep visible focus on issues that impact customer trust.",
          items: ["Failed payments", "Late deliveries", "Support escalations"],
        },
        {
          icon: Settings,
          title: "System configuration",
          description: "Control global settings with traceable and intentional changes.",
          items: ["Feature toggles", "Workflow defaults", "Operational safeguards"],
        },
      ]}
    />
  );
}
