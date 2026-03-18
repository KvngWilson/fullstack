import { productsApi } from "@/api/endpoints/products";

export const productsService = {
  getProducts: (filters = {}) => productsApi.getProducts(filters),
  getProductById: (id) => productsApi.getProductById(id),
  getCategories: () => productsApi.getCategories(),
  searchProducts: (query, filters) =>
    productsApi.searchProducts(query, filters),
  getFeaturedProducts: (limit = 8) => productsApi.getFeaturedProducts(limit),
  getProductsByCategory: (categoryId, filters) =>
    productsApi.getProductsByCategory(categoryId, filters),
};

export default productsService;
