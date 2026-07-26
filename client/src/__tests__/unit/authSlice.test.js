import reducer, {
  setUser,
  clearUser,
  clearError,
} from "@/features/auth/authSlice";
import {
  loginThunk,
  registerThunk,
  logoutThunk,
  refreshTokenThunk,
  fetchCurrentUserThunk,
} from "@/features/auth/authThunks";

describe("authSlice reducer", () => {
  const initState = () => reducer(undefined, { type: "@@INIT" });

  it("handles setUser, clearUser, and clearError reducers", () => {
    const populated = reducer(
      initState(),
      setUser({ id: 7, role: "customer" }),
    );
    expect(populated.user).toEqual({ id: 7, role: "customer" });
    expect(populated.isAuthenticated).toBe(true);
    expect(populated.isHydrated).toBe(true);

    const withError = { ...populated, error: "bad" };
    const errorCleared = reducer(withError, clearError());
    expect(errorCleared.error).toBeNull();

    const cleared = reducer(errorCleared, clearUser());
    expect(cleared.user).toBeNull();
    expect(cleared.isAuthenticated).toBe(false);
    expect(cleared.isHydrated).toBe(true);
  });

  it("handles login lifecycle reducers", () => {
    const pending = reducer(initState(), { type: loginThunk.pending.type });
    expect(pending.isLoading).toBe(true);
    expect(pending.error).toBeNull();

    const fulfilled = reducer(pending, {
      type: loginThunk.fulfilled.type,
      payload: { user: { id: 1, role: "customer" } },
    });
    expect(fulfilled.isLoading).toBe(false);
    expect(fulfilled.isAuthenticated).toBe(true);
    expect(fulfilled.user).toEqual({ id: 1, role: "customer" });

    const rejected = reducer(initState(), {
      type: loginThunk.rejected.type,
      payload: "Login failed from API",
    });
    expect(rejected.isLoading).toBe(false);
    expect(rejected.error).toBe("Login failed from API");
    expect(rejected.isAuthenticated).toBe(false);
    expect(rejected.isHydrated).toBe(true);
  });

  it("handles register lifecycle reducers with fallback error message", () => {
    const pending = reducer(initState(), { type: registerThunk.pending.type });
    expect(pending.isLoading).toBe(true);

    const fulfilled = reducer(pending, {
      type: registerThunk.fulfilled.type,
      payload: { user: { id: 9, role: "customer" } },
    });
    expect(fulfilled.isLoading).toBe(false);
    expect(fulfilled.user).toEqual({ id: 9, role: "customer" });
    expect(fulfilled.isAuthenticated).toBe(true);

    const rejected = reducer(initState(), {
      type: registerThunk.rejected.type,
      payload: undefined,
    });
    expect(rejected.error).toBe("Registration failed");
    expect(rejected.isAuthenticated).toBe(false);
    expect(rejected.isHydrated).toBe(true);
  });

  it("handles logout lifecycle reducers", () => {
    const initial = { ...initState(), user: { id: 4 }, isAuthenticated: true };

    const pending = reducer(initial, { type: logoutThunk.pending.type });
    expect(pending.isLoading).toBe(true);

    const fulfilled = reducer(pending, { type: logoutThunk.fulfilled.type });
    expect(fulfilled.isLoading).toBe(false);
    expect(fulfilled.user).toBeNull();
    expect(fulfilled.isAuthenticated).toBe(false);
    expect(fulfilled.error).toBeNull();

    const rejected = reducer(initial, { type: logoutThunk.rejected.type });
    expect(rejected.isLoading).toBe(false);
    expect(rejected.user).toBeNull();
    expect(rejected.isAuthenticated).toBe(false);
    expect(rejected.isHydrated).toBe(true);
  });

  it("handles refresh token and initial hydration reducers", () => {
    const seeded = { ...initState(), user: { id: 2 }, isAuthenticated: true };

    const refreshFulfilledWithUser = reducer(seeded, {
      type: refreshTokenThunk.fulfilled.type,
      payload: { user: { id: 3, role: "admin" } },
    });
    expect(refreshFulfilledWithUser.user).toEqual({ id: 3, role: "admin" });

    const refreshFulfilledWithoutUser = reducer(seeded, {
      type: refreshTokenThunk.fulfilled.type,
      payload: null,
    });
    expect(refreshFulfilledWithoutUser.user).toEqual({ id: 2 });

    const refreshRejected = reducer(seeded, {
      type: refreshTokenThunk.rejected.type,
    });
    expect(refreshRejected.user).toBeNull();
    expect(refreshRejected.isAuthenticated).toBe(false);

    const hydrationPending = reducer(initState(), {
      type: fetchCurrentUserThunk.pending.type,
    });
    expect(hydrationPending.isLoading).toBe(true);

    const hydrationFulfilledUser = reducer(hydrationPending, {
      type: fetchCurrentUserThunk.fulfilled.type,
      payload: { user: { id: 5 } },
    });
    expect(hydrationFulfilledUser.user).toEqual({ id: 5 });
    expect(hydrationFulfilledUser.isAuthenticated).toBe(true);
    expect(hydrationFulfilledUser.isHydrated).toBe(true);

    const hydrationFulfilledNull = reducer(hydrationPending, {
      type: fetchCurrentUserThunk.fulfilled.type,
      payload: null,
    });
    expect(hydrationFulfilledNull.user).toBeNull();
    expect(hydrationFulfilledNull.isAuthenticated).toBe(false);
    expect(hydrationFulfilledNull.isHydrated).toBe(true);

    const hydrationRejected = reducer(hydrationPending, {
      type: fetchCurrentUserThunk.rejected.type,
    });
    expect(hydrationRejected.user).toBeNull();
    expect(hydrationRejected.isAuthenticated).toBe(false);
    expect(hydrationRejected.isHydrated).toBe(true);
  });
});
