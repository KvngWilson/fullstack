import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchProductByIdThunk } from '@/features/products/productsThunks';
import { addToCartThunk } from '@/features/cart/cartThunks';
import {
  selectCurrentProduct,
  selectProductsError,
  selectProductsIsLoading,
} from '@/features/products/productsSelectors';
import { selectCartIsLoading } from '@/features/cart/cartSelectors';
import WishlistButton from '@/features/wishlist/components/WishlistButton';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { Skeleton, TextBlockSkeleton } from '@/components/common/Skeleton';
import { notifySuccess } from '@/utils/toast';

export default function ProductDetail() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [quantity, setQuantity] = useState(1);
  const product = useAppSelector(selectCurrentProduct);
  const isLoading = useAppSelector(selectProductsIsLoading);
  const isCartLoading = useAppSelector(selectCartIsLoading);
  const error = useAppSelector(selectProductsError);
  const displayProduct = useMemo(
    () =>
      product ||
      (!isLoading
        ? {
            id: Number(id) || 1,
            name: 'Demo Product',
            brand: 'Demo',
            description: 'Demo product description.',
            base_price: 49.99,
            image_url: 'https://via.placeholder.com/600x600?text=Demo+Product',
            variants: [{ id: 1001, sku: 'DEMO-1001' }],
          }
        : null),
    [id, isLoading, product],
  );

  const defaultVariantId = useMemo(() => {
    if (!displayProduct?.variants?.length) return null;
    return displayProduct.variants[0]?.id || null;
  }, [displayProduct]);

  useEffect(() => {
    if (!id || Number.isNaN(Number(id))) return;
    dispatch(fetchProductByIdThunk(Number(id)));
  }, [dispatch, id]);

  const handleAddToCart = async () => {
    if (!defaultVariantId) return;

    const resultAction = await dispatch(
      addToCartThunk({
        variant_id: defaultVariantId,
        quantity: Math.max(1, Number(quantity) || 1),
        product_name: displayProduct?.name,
        price: Number(displayProduct?.base_price ?? displayProduct?.price ?? 49.99),
      })
    );

    if (addToCartThunk.fulfilled.match(resultAction)) {
      notifySuccess('Added to cart successfully');
    }
  };

  return (
    <div className="landing-container py-12">
      {isLoading && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="h-[420px] w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-8 w-1/3" />
            <TextBlockSkeleton />
          </div>
        </div>
      )}

      {error && (
        <ErrorState title="Failed to load product" message={error} onRetry={() => dispatch(fetchProductByIdThunk(Number(id)))} />
      )}

      {!isLoading && displayProduct && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="product-image overflow-hidden rounded-lg">
            <img
              src={displayProduct.image_url || 'https://via.placeholder.com/600x600?text=No+Image'}
              alt={displayProduct.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col">
            <div className="mb-2 text-sm text-gray-500">{displayProduct.brand || 'No brand'}</div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h1 className="text-4xl font-bold">{displayProduct.name}</h1>
              <WishlistButton productId={displayProduct.id} size="lg" />
            </div>

            <div className="mb-6">
              <p className="text-3xl font-bold text-primary">
                ${displayProduct.base_price ?? displayProduct.price ?? 0}
              </p>
            </div>

            <div className="mb-8 text-gray-700">
              <h2 className="mb-2 text-lg font-semibold">Description</h2>
              <p className="leading-relaxed">
                {displayProduct.description || 'No description available.'}
              </p>
            </div>

            {displayProduct.variants && displayProduct.variants.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold">Available Variants</h3>
                <div className="flex flex-wrap gap-2">
                  {displayProduct.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="rounded-md border px-3 py-2 text-sm"
                    >
                      {variant.sku}
                      {variant.price && ` - $${variant.price}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {defaultVariantId ? (
              <div className="card-shell mt-auto">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label htmlFor="quantity" className="mb-1 block text-sm font-medium">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="h-12 w-24 rounded-md border px-3"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isCartLoading}
                    className="btn-primary mt-auto disabled:cursor-not-allowed"
                  >
                    {isCartLoading ? 'Adding...' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-yellow-500 bg-yellow-50 p-4 text-sm text-yellow-900">
                This product is not available for purchase yet (no variants available).
              </div>
            )}

            <div className="mt-8 border-t pt-6 text-sm text-gray-600">
              <div className="flex justify-between py-2">
                <span>SKU:</span>
                <span className="font-medium">{displayProduct.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Category:</span>
                <span className="font-medium">{displayProduct.category || 'Uncategorized'}</span>
              </div>
              {displayProduct.weight && (
                <div className="flex justify-between py-2">
                  <span>Weight:</span>
                  <span className="font-medium">{displayProduct.weight} lbs</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isLoading && !displayProduct && (
        <EmptyState
          title="Product not found"
          message="The item may have been removed or is no longer available."
          actionLabel="Browse all products"
          onAction={() => navigate('/products')}
        />
      )}
    </div>
  );
}
