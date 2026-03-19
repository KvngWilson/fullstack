export const DEFAULT_PAGINATION_META = {
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export const DEFAULT_API_RESPONSE = {
  success: false,
  message: "",
  data: null,
  meta: DEFAULT_PAGINATION_META,
};
