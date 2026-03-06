import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppDispatch } from '@/store';
import { fetchCurrentUserThunk } from '@/features/auth/authThunks';
import { setUser } from '@/features/auth/authSlice';
import { CLIENT_MOCKS_ENABLED } from '@/utils/runtimeFlags';
import Header from './Header';
import Footer from './Footer';

export default function RootLayout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (CLIENT_MOCKS_ENABLED) {
      const rawMockUser = localStorage.getItem('mockAuthUser');
      if (rawMockUser) {
        try {
          dispatch(setUser(JSON.parse(rawMockUser)));
          return;
        } catch {
          localStorage.removeItem('mockAuthUser');
        }
      }
    }

    dispatch(fetchCurrentUserThunk());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
