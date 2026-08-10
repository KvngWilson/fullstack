import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  selectCartError,
  selectCartIsLoading,
  selectCartItems,
  selectCartSubtotal,
} from "@/features/cart/cartSelectors";
import {
  clearCartThunk,
  fetchCartThunk,
  removeFromCartThunk,
  updateCartItemThunk,
} from "@/features/cart/cartThunks";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import { TextBlockSkeleton } from "@/components/common/Skeleton";
import { Button, Card, Input } from "@/components/ui";
import { getStoredCurrency } from "@/preferences";
import { formatPrice } from "@/utils/format";

export default function Cart() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const isLoading = useAppSelector(selectCartIsLoading);
  const error = useAppSelector(selectCartError);
  const debounceTimersRef = useRef({});
  const pendingQuantitiesRef = useRef({});
  const currency = getStoredCurrency();

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
    const currentValue = pendingQuantitiesRef.current[cartItemId] ?? "1";
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
      localStorage.setItem("checkoutGuestHint", "1");
    } catch {
      // Ignore storage failures.
    }
    navigate("/checkout");
  };

  return (
    <div className="landing-container section-wrap">
      <div className="rounded-section border border-white/70 bg-white/82 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Shopping cart
        </p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Review what you’re taking to checkout.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
          Adjust quantities, remove items, and confirm totals before moving into the
          cleaner checkout flow.
        </p>
      </div>

      {isLoading && (
        <Card className="mt-8">
          <TextBlockSkeleton />
        </Card>
      )}

      {error && (
        <ErrorState
          className="mt-8"
          title="Failed to load cart"
          message={error}
          onRetry={() => dispatch(fetchCartThunk())}
        />
      )}

      {!isLoading && !error && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.cart_item_id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                      Cart item
                    </p>
                    <p className="mt-3 font-heading text-2xl font-semibold tracking-tight text-slate-950">
                      {item.product?.name || "Product"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Variant: {item.variant?.sku || item.variant?.id || item.variant_id}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Item price: {formatPrice(Number(item.item_total ?? 0), currency)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      key={`${item.cart_item_id}-${item.quantity}`}
                      type="number"
                      min={1}
                      defaultValue={item.quantity}
                      onChange={(event) => handleQuantityChange(item.cart_item_id, event.target.value)}
                      onBlur={() => handleQuantityBlur(item.cart_item_id)}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.cart_item_id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {!items.length && (
              <EmptyState
                className="mt-0"
                title="Your cart is empty"
                message="Add some products to continue to checkout."
                actionLabel="Continue shopping"
                onAction={() => navigate("/products")}
              />
            )}
          </div>

          <Card variant="outline" className="h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Order summary
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <span>Items</span>
                <span className="font-medium text-slate-900">{items.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">
                  {formatPrice(Number(subtotal ?? 0), currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-base font-semibold text-slate-950">
                <span>Total</span>
                <span>{formatPrice(Number(subtotal ?? 0), currency)}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                type="button"
                variant="primary"
                onClick={handleProceedToCheckout}
                disabled={!canCheckout}
              >
                Continue to Checkout
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={!items.length}
              >
                Clear Cart
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
