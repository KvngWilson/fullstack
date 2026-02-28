import { createSelector } from '@reduxjs/toolkit';

export const selectProductsState = (state) => state.products;

export const selectProducts = (state) => state.products.items;

export const selectFeaturedProducts = (state) => state.products.featuredItems;

export const selectProductCategories = (state) => state.products.categories;

export const selectCurrentProduct = (state) => state.products.currentProduct;

export const selectProductsPagination = (state) => state.products.pagination;

export const selectProductsFilters = (state) => state.products.filters;

export const selectProductsIsLoading = (state) => state.products.isLoading;

export const selectProductsError = (state) => state.products.error;

export const selectProductsCount = createSelector([selectProducts], (products) => products.length);
