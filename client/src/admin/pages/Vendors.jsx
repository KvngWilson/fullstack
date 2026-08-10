import {
  BarChart3,
  CheckCircle2,
  CircleSlash,
  Handshake,
  Store,
  UserRoundCheck,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Vendors() {
  return (
    <ControlCenterPage
      badge="Admin • Vendors"
      title="Vendor performance and governance"
      description="Oversee merchant quality, onboarding progress, and policy alignment across the marketplace."
      tags={["Onboarding", "Performance", "Compliance"]}
      actions={[
        { label: "Open settings", to: "/admin/settings" },
        { label: "Admin dashboard", to: "/admin" },
      ]}
      stats={[
        { label: "Active vendors", value: "94", change: "86 in good standing" },
        { label: "Pending review", value: "12", change: "3 nearing SLA limit" },
        { label: "Suspended accounts", value: "4", change: "2 under appeal" },
        { label: "Avg vendor rating", value: "4.7", change: "Improved this quarter" },
      ]}
      modules={[
        {
          icon: Store,
          title: "Merchant health",
          description: "Track each vendor's operational and catalog consistency.",
          items: ["Listing quality", "Fulfillment behavior", "Return/refund volume"],
        },
        {
          icon: Handshake,
          title: "Onboarding pipeline",
          description: "Move applicants through verification and launch with less friction.",
          items: ["KYC completion", "Policy acceptance", "Readiness scoring"],
        },
        {
          icon: CheckCircle2,
          title: "Compliance status",
          description: "Confirm vendors meet trust, quality, and policy requirements.",
          items: ["Policy violations", "Remediation state", "Audit history"],
        },
        {
          icon: BarChart3,
          title: "Growth analytics",
          description: "Identify high-potential merchants and expansion opportunities.",
          items: ["Revenue trajectory", "Retention signals", "Assortment expansion"],
        },
        {
          icon: UserRoundCheck,
          title: "Support collaboration",
          description: "Coordinate vendor-facing support for faster issue resolution.",
          items: ["Open escalations", "Response timeliness", "Issue recurrence"],
        },
        {
          icon: CircleSlash,
          title: "Risk containment",
          description: "Limit marketplace impact from underperforming or risky accounts.",
          items: ["Auto-flag rules", "Suspension workflow", "Reinstatement checks"],
        },
      ]}
    />
  );
}
