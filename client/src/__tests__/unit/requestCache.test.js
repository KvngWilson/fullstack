function loadRequestCacheModule() {
  jest.resetModules();
  return require("@/api/interceptors/requestCache");
}

describe("requestCacheInterceptor", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("returns config as-is for non-GET requests", async () => {
    const { requestCacheInterceptor } = loadRequestCacheModule();
    const config = { method: "POST", url: "/payments" };

    const result = requestCacheInterceptor.request(config);

    expect(result).toBe(config);
    expect(config._cacheKey).toBeUndefined();
  });

  it("returns cached promise for duplicate GET requests and resolves after response", async () => {
    const { requestCacheInterceptor } = loadRequestCacheModule();

    const firstConfig = { method: "GET", url: "/orders", params: { page: 1 } };
    const firstResult = requestCacheInterceptor.request(firstConfig);
    expect(firstResult).toBe(firstConfig);
    expect(firstConfig._cacheKey).toBeTruthy();

    const duplicateConfig = {
      method: "GET",
      url: "/orders",
      params: { page: 1 },
    };
    const cachedError = await Promise.resolve(
      requestCacheInterceptor.request(duplicateConfig),
    ).catch((err) => err);

    const cachedPromise = requestCacheInterceptor.error(cachedError);

    const response = {
      config: firstConfig,
      data: { data: [{ id: 1 }] },
      status: 200,
    };

    requestCacheInterceptor.response(response);

    await expect(cachedPromise).resolves.toEqual(response);
  });

  it("rejects cached duplicate promise when source request fails", async () => {
    const { requestCacheInterceptor } = loadRequestCacheModule();

    const firstConfig = {
      method: "GET",
      url: "/shipping/rates",
      params: { country: "US" },
    };
    requestCacheInterceptor.request(firstConfig);

    const duplicateConfig = {
      method: "GET",
      url: "/shipping/rates",
      params: { country: "US" },
    };
    const cachedError = await Promise.resolve(
      requestCacheInterceptor.request(duplicateConfig),
    ).catch((err) => err);

    const queuedPromise = requestCacheInterceptor.error(cachedError);

    const sourceError = new Error("Network failure");
    sourceError.config = firstConfig;

    await expect(requestCacheInterceptor.error(sourceError)).rejects.toThrow(
      "Network failure",
    );
    await expect(queuedPromise).rejects.toThrow("Network failure");
  });

  it("passes through non-cached errors", async () => {
    const { requestCacheInterceptor } = loadRequestCacheModule();

    const error = new Error("Bad request");

    await expect(requestCacheInterceptor.error(error)).rejects.toThrow(
      "Bad request",
    );
  });
});
