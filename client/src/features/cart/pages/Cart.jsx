import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectCartError,
  selectCartIsLoading,
  selectCartItems,
  selectCartSubtotal,
} from '@/features/cart/cartSelectors';
import {
  clearCartThunk,
  fetchCartThunk,
  removeFromCartThunk,
  updateCartItemThunk,
} from '@/features/cart/cartThunks';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';

export default function Cart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const isLoading = useAppSelector(selectCartIsLoading);
  const error = useAppSelector(selectCartError);
  const debounceTimersRef = useRef({});
  const pendingQuantitiesRef = useRef({});

  useEffect(() => {
    dispatch(fetchCartThunk());
  }, [dispatch]);

  useEffect(
    () => () => {
      Object.values(debounceTimersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const commitQuantity = (cartItemId, value) => {
    const quantity = Math.max(1, Number(value) || 1);
    dispatch(updateCartItemThunk({ cart_item_id: cartItemId, quantity }));
  };

  const handleQuantityChange = (cartItemId, value) => {
    pendingQuantitiesRef.current[cartItemId] = value;

    if (debounceTimersRef.current[cartItemId]) {
      clearTimeout(debounceTimersRef.current[cartItemId]);
    }

    debounceTimersRef.current[cartItemId] = setTimeout(() => {
      commitQuantity(cartItemId, value);
    }, 450);
  };

  const handleQuantityBlur = (cartItemId) => {
    const currentValue = pendingQuantitiesRef.current[cartItemId] ?? '1';
    if (debounceTimersRef.current[cartItemId]) {
      clearTimeout(debounceTimersRef.current[cartItemId]);
      delete debounceTimersRef.current[cartItemId];
    }
    commitQuantity(cartItemId, currentValue);
  };

  const handleRemove = (cartItemId) => {
    if (debounceTimersRef.current[cartItemId]) {
      clearTimeout(debounceTimersRef.current[cartItemId]);
      delete debounceTimersRef.current[cartItemId];
    }
    delete pendingQuantitiesRef.current[cartItemId];
    dispatch(removeFromCartThunk(cartItemId));
  };

  const handleClear = () => {
    dispatch(clearCartThunk());
  };

  const canCheckout = !isLoading && items.length > 0;

  const handleProceedToCheckout = () => {
    if (!canCheckout) {
      return;
    }
    try {
      localStorage.setItem('checkoutGuestHint', '1');
    } catch {
      // Ignore storage failures.
    }
    navigate('/checkout');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Cart</h1>

      {isLoading && (
        <div className="mt-6 space-y-4">
          <TextBlockSkeleton />
          <TextBlockSkeleton />
        </div>
      )}
      {error && <ErrorState className="mt-4" title="Failed to load cart" message={error} onRetry={() => dispatch(fetchCartThunk())} />}

      {!isLoading && !error && (
        <>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div
                key={item.cart_item_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{item.product?.name || 'Product'}</p>
                  <p className="text-sm text-muted-foreground">
                    Variant: {item.variant?.sku || item.variant?.id || item.variant_id}
                  </p>
                  <p className="text-sm text-muted-foreground">Item price: ${item.item_total ?? 0}</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    key={`${item.cart_item_id}-${item.quantity}`}
                    type="number"
                    min={1}
                    defaultValue={item.quantity}
                    onChange={(event) => handleQuantityChange(item.cart_item_id, event.target.value)}
                    onBlur={() => handleQuantityBlur(item.cart_item_id)}
                    className="h-10 w-24 rounded-md border px-3"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(item.cart_item_id)}
                    className="h-10 rounded-md border px-3 hover:bg-accent"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!items.length && (
            <EmptyState
              className="mt-4"
              title="Your cart is empty"
              message="Add some products to continue to checkout."
              actionLabel="Continue Shopping"
              onAction={() => navigate('/products')}
            />
          )}

          <div className="mt-6 rounded-md border p-4">
            <p className="font-medium">Amount: ${subtotal ?? 0}</p>
            <p className="mt-1 font-semibold">Total: ${subtotal ?? 0}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={!items.length}
                className="h-10 rounded-md border px-4 hover:bg-accent disabled:opacity-60"
              >
                Clear Cart
              </button>
              <button
                type="button"
                onClick={handleProceedToCheckout}
                disabled={!canCheckout}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue to Checkout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
