import { createSelector } from '@reduxjs/toolkit';
import {
  selectAllProducts,
  selectProductById,
  selectProductIds,
  selectFeaturedProducts,
  selectCurrentProduct,
  selectProductFilters,
  selectProductPagination,
  selectProductsLoading,
  selectProductsError,
  selectCategories,
} from './productsSlice';

// Re-export from slice for backward compatibility and centralization
export {
  selectAllProducts as selectProducts,
  selectProductById,
  selectProductIds,
  selectFeaturedProducts,
  selectCurrentProduct,
  selectCategories as selectProductCategories,
  selectProductFilters,
  selectProductPagination as selectProductsPagination,
  selectProductsLoading as selectProductsIsLoading,
  selectProductsError,
};

// Additional computed selectors
export const selectProductsCount = createSelector(
  [selectAllProducts],
  (products) => products.length
);

export const selectFeaturedProductsCount = createSelector(
  [selectFeaturedProducts],
  (products) => products.length
);

export const selectHasProducts = createSelector(
  [selectProductsCount],
  (count) => count > 0
);

export const selectProductsByCategory = createSelector(
  [selectAllProducts, (_, category) => category],
  (products, category) =>
    category ? products.filter((p) => p.category === category) : products
);

export const selectProductsByPriceRange = createSelector(
  [selectAllProducts, (_, minPrice, maxPrice) => [minPrice, maxPrice]],
  (products, [minPrice, maxPrice]) =>
    products.filter(
      (p) =>
        (minPrice === undefined || p.price >= minPrice) &&
        (maxPrice === undefined || p.price <= maxPrice)
    )
);

export const selectProductsState = (state) => state.products;
