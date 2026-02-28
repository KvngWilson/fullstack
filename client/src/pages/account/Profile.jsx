import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUserProfileThunk } from '@/features/user/userThunks';
import {
  selectUserError,
  selectUserIsLoading,
  selectUserProfile,
} from '@/features/user/userSelectors';

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

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!isLoading && !error && profile && (
        <div className="mt-4 rounded-md border p-4">
          <p className="font-medium">
            {profile.first_name} {profile.last_name}
          </p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">Role: {profile.role || 'customer'}</p>
        </div>
      )}

      {!isLoading && !error && !profile && (
        <p className="mt-4 text-sm text-muted-foreground">No profile data found.</p>
      )}
    </div>
  );
}
