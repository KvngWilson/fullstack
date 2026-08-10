import {
  loginThunk,
  registerThunk,
  logoutThunk,
  refreshTokenThunk,
  fetchCurrentUserThunk,
} from "@/features/auth/authThunks";
import { authService } from "@/services/authService";

jest.mock("@/services/authService", () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    me: jest.fn(),
  },
}));

const mockAuthApi = authService;

describe("authThunks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns user payload from loginThunk on success", async () => {
    mockAuthApi.login.mockResolvedValueOnce({
      user: { id: 1, role: "customer" },
    });

    const thunk = loginThunk({ email: "user@example.com", password: "pass" });
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/login/fulfilled");
    expect(result.payload).toEqual({ user: { id: 1, role: "customer" } });
    expect(mockAuthApi.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "pass",
    });
  });

  it("returns reject payload from loginThunk on API error", async () => {
    mockAuthApi.login.mockRejectedValueOnce(new Error("Invalid credentials"));

    const thunk = loginThunk({ email: "user@example.com", password: "wrong" });
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/login/rejected");
    expect(result.payload).toBe("Invalid credentials");
  });

  it("returns reject payload from registerThunk on API error", async () => {
    mockAuthApi.register.mockRejectedValueOnce(new Error("Register denied"));

    const thunk = registerThunk({
      email: "user@example.com",
      password: "pass",
    });
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/register/rejected");
    expect(result.payload).toBe("Register denied");
  });

  it("returns user payload from registerThunk on success", async () => {
    mockAuthApi.register.mockResolvedValueOnce({
      user: { id: 2, role: "customer" },
    });

    const thunk = registerThunk({
      email: "new@example.com",
      password: "pass1234",
    });
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/register/fulfilled");
    expect(result.payload).toEqual({ user: { id: 2, role: "customer" } });
  });

  it("returns null from logoutThunk on success", async () => {
    mockAuthApi.logout.mockResolvedValueOnce({ success: true });

    const thunk = logoutThunk();
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/logout/fulfilled");
    expect(result.payload).toBeNull();
  });

  it("returns reject payload from logoutThunk when API fails", async () => {
    mockAuthApi.logout.mockRejectedValueOnce(new Error("Logout failed"));

    const thunk = logoutThunk();
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/logout/rejected");
    expect(result.payload).toBe("Logout failed");
  });

  it("returns null payload from refreshTokenThunk when response has no user", async () => {
    mockAuthApi.refreshToken.mockResolvedValueOnce({});

    const thunk = refreshTokenThunk();
    const result = await thunk(jest.fn(), jest.fn(), undefined);

    expect(result.type).toBe("auth/refreshToken/fulfilled");
    expect(result.payload).toBeNull();
  });

  it("returns user payload from refreshTokenThunk on success and reject payload on error", async () => {
    mockAuthApi.refreshToken.mockResolvedValueOnce({
      user: { id: 3, role: "admin" },
    });

    const okThunk = refreshTokenThunk();
    const okResult = await okThunk(jest.fn(), jest.fn(), undefined);

    expect(okResult.type).toBe("auth/refreshToken/fulfilled");
    expect(okResult.payload).toEqual({ user: { id: 3, role: "admin" } });

    mockAuthApi.refreshToken.mockRejectedValueOnce(new Error("Refresh failed"));

    const failThunk = refreshTokenThunk();
    const failResult = await failThunk(jest.fn(), jest.fn(), undefined);

    expect(failResult.type).toBe("auth/refreshToken/rejected");
    expect(failResult.payload).toBe("Refresh failed");
  });

  it("returns user payload from fetchCurrentUserThunk and reject payload on failure", async () => {
    mockAuthApi.me.mockResolvedValueOnce({ user: { id: 11, role: "admin" } });

    const okThunk = fetchCurrentUserThunk();
    const okResult = await okThunk(jest.fn(), jest.fn(), undefined);

    expect(okResult.type).toBe("auth/fetchCurrentUser/fulfilled");
    expect(okResult.payload).toEqual({ user: { id: 11, role: "admin" } });

    mockAuthApi.me.mockRejectedValueOnce(new Error("Session expired"));

    const failThunk = fetchCurrentUserThunk();
    const failResult = await failThunk(jest.fn(), jest.fn(), undefined);

    expect(failResult.type).toBe("auth/fetchCurrentUser/rejected");
    expect(failResult.payload).toBe("Session expired");
  });
});
