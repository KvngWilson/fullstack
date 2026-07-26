import {
  BadgeCheck,
  Box,
  Layers3,
  Megaphone,
  PackageOpen,
  Tags,
} from "lucide-react";
import ControlCenterPage from "@/components/layout/ControlCenterPage";

export default function Products() {
  return (
    <ControlCenterPage
      badge="Vendor • Products"
      title="Catalog and merchandising"
      description="Manage your product assortment with consistent quality, accurate pricing, and modern merchandising controls."
      tags={["Catalog quality", "Pricing", "Merchandising"]}
      actions={[
        { label: "Inventory board", to: "/vendor/inventory" },
        { label: "Back to dashboard", to: "/vendor" },
      ]}
      stats={[
        { label: "Active products", value: "312", change: "+24 this month" },
        { label: "Draft listings", value: "18", change: "6 awaiting images" },
        { label: "Variant count", value: "1,046", change: "Healthy depth by size/color" },
        { label: "Out-of-stock products", value: "9", change: "Down from 15" },
      ]}
      modules={[
        {
          icon: Box,
          title: "Listing management",
          description: "Keep product data complete, accurate, and easy to discover.",
          items: ["Attribute completeness", "SEO-friendly content", "Media consistency"],
        },
        {
          icon: Layers3,
          title: "Variant strategy",
          description: "Organize options to make buying simple and scalable.",
          items: ["SKU structure", "Variant coverage", "Option simplification"],
        },
        {
          icon: Tags,
          title: "Pricing controls",
          description: "Maintain competitive pricing with clear profitability guardrails.",
          items: ["Price drift alerts", "Margin thresholds", "Promo-safe price floors"],
        },
        {
          icon: BadgeCheck,
          title: "Catalog quality",
          description: "Prevent data errors that can hurt conversion and trust.",
          items: ["Validation issues", "Policy checks", "Quality score improvements"],
        },
        {
          icon: Megaphone,
          title: "Merchandising execution",
          description: "Spot opportunities to improve conversion on key products.",
          items: ["Featured lineup", "Seasonal collections", "Campaign alignment"],
        },
        {
          icon: PackageOpen,
          title: "Lifecycle planning",
          description: "Plan launches, refreshes, and retirements with confidence.",
          items: ["Upcoming launches", "Stale inventory rotation", "Delist readiness"],
        },
      ]}
    />
  );
}
