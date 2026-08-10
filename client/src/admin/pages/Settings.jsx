import {
  Database,
  Globe,
  KeySquare,
  LayoutTemplate,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Settings() {
  return (
    <ControlCenterPage
      badge="Admin • Settings"
      title="Platform configuration"
      description="Manage global defaults, operational safeguards, and platform behavior through a clear and auditable configuration layer."
      tags={["Governance", "Configuration", "Auditability"]}
      actions={[
        { label: "Back to dashboard", to: "/admin" },
        { label: "Vendor governance", to: "/admin/vendors" },
      ]}
      stats={[
        { label: "Config updates", value: "12", change: "Last 7 days" },
        { label: "Pending approvals", value: "3", change: "2 involve policy changes" },
        { label: "Feature flags", value: "28", change: "4 in staged rollout" },
        { label: "Audit coverage", value: "100%", change: "All changes logged" },
      ]}
      modules={[
        {
          icon: Settings2,
          title: "Operational defaults",
          description: "Tune baseline behavior for orders, shipping, and support workflows.",
          items: ["Order thresholds", "Escalation defaults", "Workflow automations"],
        },
        {
          icon: ShieldCheck,
          title: "Security controls",
          description: "Configure authentication and permission safeguards.",
          items: ["Session policy", "Role boundaries", "Sensitive action approval"],
        },
        {
          icon: LayoutTemplate,
          title: "Experience settings",
          description: "Control interface behaviors for different internal teams.",
          items: ["Role-specific views", "Module visibility", "Navigation defaults"],
        },
        {
          icon: Database,
          title: "Data management",
          description: "Set retention and data quality policies for platform records.",
          items: ["Archival windows", "Validation rules", "Integrity checks"],
        },
        {
          icon: Globe,
          title: "Regional behavior",
          description: "Define locale-sensitive settings and fulfillment conventions.",
          items: ["Currency defaults", "Timezone strategy", "Regional restrictions"],
        },
        {
          icon: KeySquare,
          title: "Change governance",
          description: "Apply controlled approval workflows for high-impact settings.",
          items: ["Approval chains", "Change windows", "Rollback readiness"],
        },
      ]}
    />
  );
}
