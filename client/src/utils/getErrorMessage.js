export const getErrorMessage = (error, fallback = 'An unexpected error occurred') => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};
