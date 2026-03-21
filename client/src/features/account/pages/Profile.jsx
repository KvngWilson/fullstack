import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchUserProfileThunk } from "@/features/user/userThunks";
import {
  selectUserError,
  selectUserIsLoading,
  selectUserProfile,
} from "@/features/user/userSelectors";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";

export default function Profile() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectUserProfile);
  const isLoading = useAppSelector(selectUserIsLoading);
  const error = useAppSelector(selectUserError);

  useEffect(() => {
    dispatch(fetchUserProfileThunk());
  }, [dispatch]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Profile</h1>

      {isLoading && (
        <div className="mt-4">
          <TextBlockSkeleton />
        </div>
      )}
      {error && (
        <ErrorState
          className="mt-4"
          title="Failed to load profile"
          message={error}
          onRetry={() => dispatch(fetchUserProfileThunk())}
        />
      )}

      {!isLoading && !error && profile && (
        <div className="mt-4 rounded-md border p-4">
          <p className="font-medium">
            {profile.first_name} {profile.last_name}
          </p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Role: {profile.role || "customer"}
          </p>
        </div>
      )}

      {!isLoading && !error && !profile && (
        <EmptyState
          className="mt-4"
          title="No profile data found"
          message="Refresh the page or try again in a moment."
        />
      )}
    </div>
  );
}
