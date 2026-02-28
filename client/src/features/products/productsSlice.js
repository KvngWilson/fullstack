import { createSlice } from '@reduxjs/toolkit';
import {
  fetchProductsThunk,
  fetchProductByIdThunk,
  fetchCategoriesThunk,
  fetchFeaturedProductsThunk,
  searchProductsThunk,
} from './productsThunks';

const initialState = {
  items: [],
  featuredItems: [],
  categories: [],
  currentProduct: null,
  pagination: null,
  filters: {},
  isLoading: false,
  error: null,
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProductFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetProductFilters: (state) => {
      state.filters = {};
    },
    clearCurrentProduct: (state) => {
      state.currentProduct = null;
    },
    clearProductsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProductsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload?.products || [];
        state.pagination = action.payload?.pagination || null;
      })
      .addCase(fetchProductsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch products';
      })
      .addCase(fetchProductByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProductByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProduct = action.payload || null;
      })
      .addCase(fetchProductByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch product details';
      })
      .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
        state.categories = action.payload || [];
      })
      .addCase(fetchCategoriesThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to fetch categories';
      })
      .addCase(fetchFeaturedProductsThunk.fulfilled, (state, action) => {
        state.featuredItems = action.payload || [];
      })
      .addCase(fetchFeaturedProductsThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to fetch featured products';
      })
      .addCase(searchProductsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchProductsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload?.products || [];
        state.pagination = action.payload?.pagination || null;
      })
      .addCase(searchProductsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to search products';
      });
  },
});

export const {
  setProductFilters,
  resetProductFilters,
  clearCurrentProduct,
  clearProductsError,
} = productsSlice.actions;

export default productsSlice.reducer;
