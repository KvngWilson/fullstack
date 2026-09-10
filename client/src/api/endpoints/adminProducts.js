import apiClient, { uploadClient } from "../client";
import { productsApi } from "./products";

function buildProductFormData(product) {
  const formData = new FormData();

  [
    "name",
    "slug",
    "description",
    "category_id",
    "vendor_id",
    "base_price",
    "brand",
    "material",
    "care_instructions",
    "sku",
    "stock",
    "is_active",
  ].forEach((field) => {
    if (product[field] !== undefined && product[field] !== null && product[field] !== "") {
      formData.append(field, product[field]);
    }
  });

  if (product.imageFile instanceof File) {
    formData.append("image", product.imageFile);
  }

  return formData;
}

export const adminProductsApi = {
  listProducts: (filters = {}) => productsApi.getProducts(filters),
  getProductById: (id) => productsApi.getProductById(id),
  getCategories: () => productsApi.getCategories(),
  listVendors: async () => {
    const response = await apiClient.get("/admin/products/vendors");
    return response?.data || response || [];
  },
  createProduct: async (product) => {
    return uploadClient.post("/catalog/products", buildProductFormData(product), {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  updateProduct: async (productId, product) => {
    return uploadClient.put(
      `/catalog/products/${productId}`,
      buildProductFormData(product),
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  },
  deleteProduct: async (productId) => {
    return apiClient.delete(`/catalog/products/${productId}`);
  },
};

export default adminProductsApi;
