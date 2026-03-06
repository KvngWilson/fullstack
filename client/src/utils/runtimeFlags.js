const mode = import.meta.env.MODE;

export const CLIENT_MOCKS_ENABLED =
  import.meta.env.VITE_ENABLE_CLIENT_MOCKS === 'true' ||
  import.meta.env.DEV ||
  mode === 'test';
