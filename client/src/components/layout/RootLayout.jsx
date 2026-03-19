import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppDispatch } from '@/store';
import { fetchCurrentUserThunk } from '@/features/auth/authThunks';
import Header from './Header';
import Footer from './Footer';

export default function RootLayout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
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
