import { createAsyncThunk } from "@reduxjs/toolkit";
import { productsService } from "@/services/productService";
import { getErrorMessage } from "@/utils/getErrorMessage";

export const fetchProductsThunk = createAsyncThunk(
  "products/fetchProducts",
  async (filters = {}, { rejectWithValue }) => {
    try {
      return await productsService.getProducts(filters);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchProductByIdThunk = createAsyncThunk(
  "products/fetchProductById",
  async (productId, { rejectWithValue }) => {
    try {
      return await productsService.getProductById(productId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchCategoriesThunk = createAsyncThunk(
  "products/fetchCategories",
  async (_, { rejectWithValue }) => {
    try {
      return await productsService.getCategories();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchFeaturedProductsThunk = createAsyncThunk(
  "products/fetchFeaturedProducts",
  async (limit = 8, { rejectWithValue }) => {
    try {
      return await productsService.getFeaturedProducts(limit);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const searchProductsThunk = createAsyncThunk(
  "products/searchProducts",
  async ({ query, filters = {} }, { rejectWithValue }) => {
    try {
      return await productsService.searchProducts(query, filters);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);
