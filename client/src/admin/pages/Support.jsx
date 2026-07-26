import {
  Bot,
  ClipboardCheck,
  LifeBuoy,
  MessageSquareWarning,
  PhoneCall,
  TimerReset,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Support() {
  return (
    <ControlCenterPage
      badge="Admin • Support"
      title="Customer support operations"
      description="Coordinate support throughput, escalation handling, and service quality from a single workspace."
      tags={["Escalations", "SLA tracking", "Resolution quality"]}
      actions={[
        { label: "View users", to: "/admin/users" },
        { label: "Order center", to: "/admin/orders" },
      ]}
      stats={[
        { label: "Open conversations", value: "64", change: "18 high priority" },
        { label: "First response", value: "5m 42s", change: "Faster than target" },
        { label: "Resolution SLA", value: "97.1%", change: "Stable over 30 days" },
        { label: "CSAT score", value: "4.8/5", change: "Up 0.2 this month" },
      ]}
      modules={[
        {
          icon: LifeBuoy,
          title: "Queue management",
          description: "Route incoming requests by urgency and customer impact.",
          items: ["Priority routing", "Backlog management", "Ownership balancing"],
        },
        {
          icon: MessageSquareWarning,
          title: "Escalation response",
          description: "Accelerate recovery for high-impact incidents and complaints.",
          items: ["Executive escalations", "Vendor escalations", "Fraud-related concerns"],
        },
        {
          icon: ClipboardCheck,
          title: "Quality assurance",
          description: "Maintain high standards in response quality and policy adherence.",
          items: ["Conversation reviews", "Policy compliance checks", "Coaching opportunities"],
        },
        {
          icon: PhoneCall,
          title: "Omnichannel coordination",
          description: "Unify context across chat, email, and voice touchpoints.",
          items: ["Cross-channel history", "Case continuity", "Callback commitments"],
        },
        {
          icon: Bot,
          title: "Automation health",
          description: "Ensure automations assist agents without reducing experience quality.",
          items: ["Auto-reply impact", "Deflection accuracy", "Fallback confidence"],
        },
        {
          icon: TimerReset,
          title: "SLA recovery",
          description: "Trigger remediation workflows for at-risk or breached tickets.",
          items: ["Breach prevention", "Rapid reassignment", "Follow-up sequencing"],
        },
      ]}
    />
  );
}
