import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAppDispatch } from "@/store";
import { fetchCurrentUserThunk } from "@/features/auth/authThunks";
import Header from "./Header";
import Footer from "./Footer";

export default function RootLayout() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUserThunk());
  }, [dispatch]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-122 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%)]"
      />
      <Header />
      <main className="relative flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
