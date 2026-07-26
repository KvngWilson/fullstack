import {
  BarChart3,
  ChartColumnIncreasing,
  Gem,
  Goal,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Analytics() {
  return (
    <ControlCenterPage
      badge="Vendor • Analytics"
      title="Business intelligence workspace"
      description="Turn store data into decisions with a clear view of growth, customer behavior, and product performance."
      tags={["Growth insights", "Customer behavior", "Product performance"]}
      actions={[
        { label: "View products", to: "/vendor/products" },
        { label: "Back to dashboard", to: "/vendor" },
      ]}
      stats={[
        { label: "Monthly revenue", value: "$182k", change: "+18% MoM" },
        { label: "Conversion rate", value: "4.9%", change: "Up 0.6pp" },
        { label: "Average order value", value: "$72", change: "Stable with strong margin" },
        { label: "Repeat purchase rate", value: "38%", change: "Up 5pp in 60 days" },
      ]}
      modules={[
        {
          icon: ChartColumnIncreasing,
          title: "Revenue trends",
          description: "See how sales performance evolves by day, week, and month.",
          items: ["Growth trajectory", "Promo effectiveness", "Revenue concentration"],
        },
        {
          icon: ShoppingBag,
          title: "Product contribution",
          description: "Understand which products drive orders, margin, and retention.",
          items: ["Top SKU contribution", "Underperforming catalog", "Attach-rate insights"],
        },
        {
          icon: UserRound,
          title: "Customer behavior",
          description: "Analyze lifecycle and retention patterns that influence repeat business.",
          items: ["New vs returning mix", "Repurchase timing", "Cohort retention"],
        },
        {
          icon: BarChart3,
          title: "Channel effectiveness",
          description: "Measure how acquisition channels impact quality and profitability.",
          items: ["Channel conversion", "Traffic quality", "Campaign ROI"],
        },
        {
          icon: Goal,
          title: "KPI alignment",
          description: "Track progress against strategic targets in one place.",
          items: ["Goal tracking", "Performance variance", "Actionable priorities"],
        },
        {
          icon: Gem,
          title: "Premium opportunities",
          description: "Spot high-value segments and high-margin expansion opportunities.",
          items: ["High-LTV customers", "Premium product demand", "Upsell pathways"],
        },
      ]}
    />
  );
}
