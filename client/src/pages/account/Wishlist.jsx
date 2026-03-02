import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchWishlistThunk,
  removeFromWishlistThunk,
  clearWishlistThunk,
} from '@/features/wishlist/wishlistThunks';
import {
  selectWishlistItems,
  selectWishlistIsLoading,
  selectWishlistError,
} from '@/features/wishlist/wishlistSelectors';
import { addToCartThunk } from '@/features/cart/cartThunks';
import { Trash2, ShoppingCart } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { ProductGridSkeleton } from '@/components/common/Skeleton';

export default function Wishlist() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectWishlistItems);
  const isLoading = useAppSelector(selectWishlistIsLoading);
  const error = useAppSelector(selectWishlistError);

  useEffect(() => {
    dispatch(fetchWishlistThunk());
  }, [dispatch]);

  const handleRemove = (productId) => {
    dispatch(removeFromWishlistThunk(productId));
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear your wishlist?')) {
      dispatch(clearWishlistThunk());
    }
  };

  const handleAddToCart = (product) => {
    // Get first available variant
    const variant = product.variants?.[0];
    if (variant) {
      dispatch(addToCartThunk({ variant_id: variant.id, quantity: 1 }));
    }
  };

  return (
    <div className="landing-container py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold">My Wishlist</h1>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="btn-ghost text-sm"
          >
            Clear All
          </button>
        )}
      </div>

      {isLoading && (
        <div className="py-6">
          <ProductGridSkeleton count={4} />
        </div>
      )}

      {error && (
        <ErrorState title="Failed to load wishlist" message={error} onRetry={() => dispatch(fetchWishlistThunk())} />
      )}

      {!isLoading && !error && (
        <>
          {items.length === 0 ? (
            <EmptyState
              className="py-16"
              title="Your wishlist is empty"
              message="Start adding products you love."
              actionLabel="Browse products"
              onAction={() => navigate('/products')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.wishlist_id} className="product-card group">
                  <Link to={`/products/${item.product_id}`} className="block">
                    <div className="product-image mb-3">
                      <img
                        src={item.image_url || 'https://via.placeholder.com/300x300?text=No+Image'}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  </Link>

                  <div className="flex-1">
                    <Link to={`/products/${item.product_id}`}>
                      <p className="mb-1 text-sm text-gray-500">{item.vendor_name || 'No vendor'}</p>
                      <h3 className="mb-2 line-clamp-2 font-semibold text-gray-900">{item.name}</h3>
                    </Link>

                    <p className="mb-3 text-lg font-bold text-primary">
                      ${item.base_price ?? 0}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={!item.variants || item.variants.length === 0}
                        className="btn-primary flex-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        title="Add to cart"
                      >
                        <ShoppingCart className="mr-1 inline h-4 w-4" />
                        Add to Cart
                      </button>
                      <button
                        onClick={() => handleRemove(item.product_id)}
                        className="rounded-md border border-gray-300 p-2 text-gray-600 transition hover:border-red-500 hover:bg-red-50 hover:text-red-600"
                        title="Remove from wishlist"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-gray-500">
                      Added {new Date(item.added_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-8 text-center text-sm text-gray-600">
              {items.length} {items.length === 1 ? 'item' : 'items'} in your wishlist
            </div>
          )}
        </>
      )}
    </div>
  );
}
