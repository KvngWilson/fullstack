import apiClient from "../client";

const normalizeProductsListResponse = (response) => {
  if (!response) {
    return { products: [], pagination: null };
  }

  const products = response.data || response.products || [];
  const pagination = response.pagination || response.meta || null;

  return {
    products,
    pagination,
  };
};

export const productsApi = {
  // Get all products with filters
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const query = params.toString();
    const response = await apiClient.get(
      `/catalog/products${query ? `?${query}` : ""}`,
    );
    return normalizeProductsListResponse(response);
  },

  // Get product by ID
  getProductById: async (id) => {
    return apiClient.get(`/catalog/products/${id}`);
  },

  // Get categories
  getCategories: async () => {
    const response = await apiClient.get("/catalog/products/categories");
    return response?.data || response || [];
  },

  // Search products
  searchProducts: async (query, filters) => {
    return productsApi.getProducts({ ...filters, search: query });
  },

  // Get featured products
  getFeaturedProducts: async (limit = 8) => {
    const response = await apiClient.get(
      `/catalog/products/featured?limit=${limit}`,
    );
    return response?.data || response || [];
  },

  // Get products by category
  getProductsByCategory: async (categoryId, filters) => {
    return productsApi.getProducts({ ...filters, category: categoryId });
  },
};
