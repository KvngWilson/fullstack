import {
  BellRing,
  KeyRound,
  Shield,
  UserCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Users() {
  return (
    <ControlCenterPage
      badge="Admin • Users"
      title="User administration and access"
      description="Manage user lifecycles, monitor account security, and maintain role-based access controls."
      tags={["Identity", "Access", "Account security"]}
      actions={[
        { label: "Support center", to: "/admin/support" },
        { label: "Platform settings", to: "/admin/settings" },
      ]}
      stats={[
        { label: "Total users", value: "12,438", change: "+254 this month" },
        { label: "Active this week", value: "8,702", change: "70% engagement" },
        { label: "Locked accounts", value: "19", change: "6 pending review" },
        { label: "Pending invites", value: "47", change: "14 sent in last 24h" },
      ]}
      modules={[
        {
          icon: UsersRound,
          title: "User lifecycle",
          description: "Track account creation, verification, and retention patterns.",
          items: ["Signup trends", "Activation funnel", "Dormant account recovery"],
        },
        {
          icon: Shield,
          title: "Security posture",
          description: "Review account-level security and suspicious authentication patterns.",
          items: ["Failed login spikes", "Password reset anomalies", "MFA adoption"],
        },
        {
          icon: KeyRound,
          title: "Role governance",
          description: "Ensure least-privilege access is maintained across teams.",
          items: ["Permission audits", "Role assignment review", "Privilege escalation checks"],
        },
        {
          icon: UserCheck,
          title: "Verification controls",
          description: "Keep trust standards high with consistent identity checks.",
          items: ["Email verification gaps", "Manual verification queue", "Trust score drift"],
        },
        {
          icon: UserPlus,
          title: "Provisioning flow",
          description: "Streamline onboarding for staff and operational users.",
          items: ["Invite lifecycle", "Activation latency", "Role template usage"],
        },
        {
          icon: BellRing,
          title: "Alerting and follow-up",
          description: "Coordinate rapid follow-up for security and support-sensitive users.",
          items: ["Critical account alerts", "SLA follow-up", "Escalation ownership"],
        },
      ]}
    />
  );
}
