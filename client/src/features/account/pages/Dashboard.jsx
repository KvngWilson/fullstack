import { Link, Navigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { selectUser } from "@/features/auth/authSelectors";
import { getPostLoginPath } from "@/features/auth/getPostLoginPath";
import AccountHeader from "@/components/layout/AccountHeader";
import { Card } from "@/components/ui";

const quickLinks = [
  {
    title: "Track recent orders",
    description: "Review current statuses, payment updates, and delivery progress.",
    to: "/account/orders",
  },
  {
    title: "Update your profile",
    description: "Keep account details and contact information current.",
    to: "/account/profile",
  },
  {
    title: "Manage saved items",
    description: "Return to the products you were considering in one tap.",
    to: "/account/wishlist",
  },
];

export default function Dashboard() {
  const user = useAppSelector(selectUser);

  const workspacePath = getPostLoginPath(user?.role);
  if (workspacePath !== "/dashboard") {
    return <Navigate to={workspacePath} replace />;
  }

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={`Welcome back${user?.first_name ? `, ${user.first_name}` : ""}.`}
        description={
          user?.email
            ? `Signed in as ${user.email}. Keep tabs on your orders, profile details, saved addresses, and shopping preferences in one polished dashboard.`
            : "You are signed in and ready to keep shopping, track orders, and manage account details."
        }
        badge="Account overview"
        stats={[
          { label: "Account status", value: "Active" },
          { label: "Checkout ready", value: "Yes" },
          { label: "Saved experience", value: "Personalized" },
        ]}
        actions={
          <>
            <Link className="btn-primary" to="/products">
              Shop now
            </Link>
            <Link className="btn-ghost" to="/account/orders">
              View orders
            </Link>
          </>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {quickLinks.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                Quick action
              </p>
              <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-slate-950">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
