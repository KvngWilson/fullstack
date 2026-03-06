import { useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchProductsThunk, searchProductsThunk } from '@/features/products/productsThunks';
import {
  selectProducts,
  selectProductsError,
  selectProductsIsLoading,
  selectProductsPagination,
} from '@/features/products/productsSelectors';
import { addToCartThunk } from '@/features/cart/cartThunks';
import WishlistButton from '@/features/wishlist/components/WishlistButton';
import { ProductGridSkeleton } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { notifyInfo, notifySuccess } from '@/utils/toast';

export default function ProductList() {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const products = useAppSelector(selectProducts);
  const pagination = useAppSelector(selectProductsPagination);
  const isLoading = useAppSelector(selectProductsIsLoading);
  const error = useAppSelector(selectProductsError);

  const category = searchParams.get('category');
  const query = searchParams.get('q');
  const fallbackProducts = [
    {
      id: 1,
      name: 'Demo Product',
      brand: 'Demo',
      base_price: 49.99,
      image_url: 'https://via.placeholder.com/300x300?text=Demo+Product',
      variant_id: 1001,
      variants: [{ id: 1001 }],
    },
    {
      id: 2,
      name: 'Demo Product 2',
      brand: 'Demo',
      base_price: 79.99,
      image_url: 'https://via.placeholder.com/300x300?text=Demo+Product+2',
      variant_id: 1002,
      variants: [{ id: 1002 }],
    },
  ];
  const displayProducts = products.length ? products : fallbackProducts;

  const loadProducts = useCallback(() => {
    if (query) {
      dispatch(searchProductsThunk({ query, filters: category ? { category: category } : {} }));
      return;
    }

    dispatch(fetchProductsThunk(category ? { category: category } : {}));
  }, [dispatch, category, query]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resolveVariantId = (product) => {
    if (product?.variant_id) return product.variant_id;
    if (product?.default_variant_id) return product.default_variant_id;
    if (Array.isArray(product?.variants) && product.variants.length > 0) {
      return product.variants[0]?.id;
    }
    return null;
  };

  const handleAddToCart = async (event, product) => {
    event.preventDefault();
    event.stopPropagation();

    const variantId = resolveVariantId(product);
    if (!variantId) {
      notifyInfo('Please open the product to choose a variant.');
      return;
    }

    const resultAction = await dispatch(
      addToCartThunk({
        variant_id: variantId,
        quantity: 1,
        product_name: product?.name,
        price: Number(product?.base_price ?? product?.price ?? 49.99),
      }),
    );

    if (addToCartThunk.fulfilled.match(resultAction)) {
      notifySuccess('Added to cart successfully');
    }
  };

  const handleRetry = () => {
    notifyInfo('Retrying product request...');
    loadProducts();
  };

  return (
    <div className="landing-container py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          {query ? `Search: "${query}"` : category ? `Category: ${category}` : 'All Products'}
        </h1>
        {pagination && (
          <p className="mt-2 text-sm text-gray-500">
            {pagination.totalCount} products found
          </p>
        )}
      </div>

      {isLoading && (
        <div className="py-2">
          <ProductGridSkeleton count={8} />
        </div>
      )}

      {error && (
        <ErrorState
          title="Unable to load products"
          message={error}
          onRetry={handleRetry}
          className="mb-6"
        />
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayProducts.map((product) => (
              <div key={product.id} className="product-card group">
                <Link to={`/products/${product.id}`} className="block">
                  <div className="product-image relative mb-3">
                    <img
                      src={product.image_url || 'https://via.placeholder.com/300x300?text=No+Image'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute right-2 top-2">
                      <WishlistButton productId={product.id} size="sm" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-sm text-gray-500">{product.brand || 'No brand'}</p>
                    <h3 className="mb-2 line-clamp-2 font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-lg font-bold text-primary">
                      ${product.base_price ?? product.price ?? 0}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={(event) => handleAddToCart(event, product)}
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>

          {!products.length && !error && (
            <EmptyState
              title="No products found"
              message="Try changing category filters or search terms."
              actionLabel="Browse All Products"
              onAction={() => {
                window.location.href = '/products';
              }}
              className="mt-6"
            />
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                disabled={pagination.page <= 1}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(pagination.page - 1));
                  window.location.search = newParams.toString();
                }}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(pagination.page + 1));
                  window.location.search = newParams.toString();
                }}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
