import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchUserProfileThunk } from "@/features/user/userThunks";
import {
  selectUserError,
  selectUserIsLoading,
  selectUserProfile,
} from "@/features/user/userSelectors";
import AccountHeader from "@/components/layout/AccountHeader";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Card, Badge } from "@/components/ui";

export default function Profile() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectUserProfile);
  const isLoading = useAppSelector(selectUserIsLoading);
  const error = useAppSelector(selectUserError);

  useEffect(() => {
    dispatch(fetchUserProfileThunk());
  }, [dispatch]);

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title="Your profile"
        description="Review the contact details and account identity information tied to your shopping experience."
        badge="Personal details"
      />

      {isLoading && (
        <Card className="mt-8">
          <TextBlockSkeleton />
        </Card>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title="Failed to load profile"
          message={error}
          onRetry={() => dispatch(fetchUserProfileThunk())}
        />
      )}

      {!isLoading && !error && profile && (
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
              Account identity
            </p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-slate-950">
              {profile.first_name} {profile.last_name}
            </h2>
            <p className="mt-3 text-sm text-slate-500">{profile.email}</p>
            <div className="mt-5">
              <Badge variant="secondary">Role: {profile.role || "customer"}</Badge>
            </div>
          </Card>

          <Card variant="outline">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Account summary
            </p>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <span>First name</span>
                <span className="font-medium text-slate-900">{profile.first_name || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Last name</span>
                <span className="font-medium text-slate-900">{profile.last_name || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Email</span>
                <span className="font-medium text-slate-900">{profile.email || "N/A"}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {!isLoading && !error && !profile && (
        <EmptyState
          className="mt-8"
          title="No profile data found"
          message="Refresh the page or try again in a moment."
        />
      )}
    </div>
  );
}
