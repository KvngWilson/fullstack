import { createSlice, createEntityAdapter, createSelector } from '@reduxjs/toolkit';
import {
  fetchProductsThunk,
  fetchProductByIdThunk,
  fetchCategoriesThunk,
  fetchFeaturedProductsThunk,
  searchProductsThunk,
} from './productsThunks';

/**
 * Entity Adapter for Products
 * Automatically generates reducers for normalized state management
 * Provides efficient CRUD operations and memoized selectors
 */
const productsAdapter = createEntityAdapter({
  selectId: (product) => product.id,
  sortComparer: (a, b) => {
    // Sort by featured status, then by rating
    if (b.isFeatured !== a.isFeatured) {
      return b.isFeatured ? 1 : -1;
    }
    return (b.rating || 0) - (a.rating || 0);
  },
});

const initialState = productsAdapter.getInitialState({
  // Store IDs of featured products (reference, not duplication)
  featuredIds: [],
  // Store IDs of search results
  searchResultIds: [],
  // Categories
  categories: [],
  // Current product being viewed
  currentProductId: null,
  // Pagination info for current list
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
  // Applied filters
  filters: {},
  // Search query
  searchQuery: '',
  // Loading and error states
  isLoading: false,
  error: null,
});

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
    setCurrentProduct: (state, action) => {
      state.currentProductId = action.payload;
    },
    clearCurrentProduct: (state) => {
      state.currentProductId = null;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearProductsError: (state) => {
      state.error = null;
    },
    // ✅ Entity adapter provides optimized reducers
    ...productsAdapter.getInitialState(),
  },
  extraReducers: (builder) => {
    // Fetch products list
    builder
      .addCase(fetchProductsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProductsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        // ✅ Normalize products into entity state
        productsAdapter.setAll(state, action.payload?.products || []);
        state.pagination = action.payload?.pagination || state.pagination;
        state.searchResultIds = [];
      })
      .addCase(fetchProductsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch products';
      });

    // Fetch single product
    builder
      .addCase(fetchProductByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProductByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          // ✅ Use adapter to upsert product
          productsAdapter.upsertOne(state, action.payload);
          state.currentProductId = action.payload.id;
        }
      })
      .addCase(fetchProductByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch product details';
      });

    // Fetch categories
    builder
      .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
        state.categories = action.payload || [];
      })
      .addCase(fetchCategoriesThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to fetch categories';
      });

    // Fetch featured products
    builder
      .addCase(fetchFeaturedProductsThunk.fulfilled, (state, action) => {
        if (action.payload && Array.isArray(action.payload)) {
          // ✅ Normalize featured products
          productsAdapter.upsertMany(state, action.payload);
          // ✅ Store IDs only, not duplicated data
          state.featuredIds = action.payload.map((p) => p.id);
        }
      })
      .addCase(fetchFeaturedProductsThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to fetch featured products';
      });

    // Search products
    builder
      .addCase(searchProductsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchProductsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload?.products) {
          // ✅ Normalize search results
          productsAdapter.upsertMany(state, action.payload.products);
          // ✅ Store result IDs for filtered view
          state.searchResultIds = action.payload.products.map((p) => p.id);
          state.pagination = action.payload.pagination || state.pagination;
        }
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
  setCurrentProduct,
  clearCurrentProduct,
  setSearchQuery,
  clearProductsError,
} = productsSlice.actions;

export default productsSlice.reducer;

// ✅ Auto-generated selectors from entity adapter
export const {
  selectAll: selectAllProducts,
  selectById: selectProductById,
  selectIds: selectProductIds,
  selectEntities: selectProductEntities,
  selectTotal: selectProductsTotal,
} = productsAdapter.getSelectors((state) => state.products);

// ✅ Custom memoized selectors
export const selectFeaturedProducts = createSelector(
  [selectAllProducts, (state) => state.products.featuredIds],
  (products, featuredIds) =>
    featuredIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
);

export const selectSearchResults = createSelector(
  [selectAllProducts, (state) => state.products.searchResultIds],
  (products, resultIds) =>
    resultIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
);

export const selectCurrentProduct = createSelector(
  [(state) => state.products],
  (productsState) =>
    productsState.currentProductId
      ? selectProductById(productsState, productsState.currentProductId)
      : null
);

export const selectProductFilters = (state) => state.products.filters;
export const selectProductPagination = (state) => state.products.pagination;
export const selectProductsLoading = (state) => state.products.isLoading;
export const selectProductsError = (state) => state.products.error;
export const selectCategories = (state) => state.products.categories;
