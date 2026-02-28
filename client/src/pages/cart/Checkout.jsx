import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearCartThunk, fetchCartThunk } from '@/features/cart/cartThunks';
import {
  selectCartItems,
  selectCartIsLoading,
  selectCartSubtotal,
} from '@/features/cart/cartSelectors';
import { createOrderThunk } from '@/features/orders/ordersThunks';
import { fetchAddressesThunk, fetchSavedCardsThunk } from '@/features/user/userThunks';
import { selectUserAddresses, selectUserSavedCards } from '@/features/user/userSelectors';

export default function Checkout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const cartLoading = useAppSelector(selectCartIsLoading);
  const addresses = useAppSelector(selectUserAddresses);
  const savedCards = useAppSelector(selectUserSavedCards);

  const [shippingAddressId, setShippingAddressId] = useState('');
  const [billingAddressId, setBillingAddressId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hasLoadedCart, setHasLoadedCart] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadCheckoutData = async () => {
      try {
        await Promise.all([
          dispatch(fetchCartThunk()),
          dispatch(fetchAddressesThunk()),
          dispatch(fetchSavedCardsThunk()),
        ]);
      } finally {
        if (isActive) {
          setHasLoadedCart(true);
        }
      }
    };

    loadCheckoutData();

    return () => {
      isActive = false;
    };
  }, [dispatch]);

  // Auto-select primary or first address/card once loaded
  useEffect(() => {
    if (addresses.length > 0 && !shippingAddressId) {
      const primaryAddress = addresses.find((addr) => addr.is_primary);
      const defaultAddress = primaryAddress || addresses[0];
      setShippingAddressId(String(defaultAddress.id));
      setBillingAddressId(String(defaultAddress.id));
    }
  }, [addresses, shippingAddressId]);

  useEffect(() => {
    if (savedCards.length > 0 && !selectedCardId) {
      const primaryCard = savedCards.find((card) => card.is_primary);
      const defaultCard = primaryCard || savedCards[0];
      setSelectedCardId(String(defaultCard.id));
    }
  }, [savedCards, selectedCardId]);

  useEffect(() => {
    if (hasLoadedCart && !cartLoading && !isSubmitting && items.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [cartLoading, hasLoadedCart, isSubmitting, items.length, navigate]);

  const orderItems = useMemo(
    () => items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
    [items],
  );

  const handlePlaceOrder = async (event) => {
    event.preventDefault();

    if (!orderItems.length) {
      setSubmitError('Your cart is empty.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const resultAction = await dispatch(
        createOrderThunk({
          shipping_address_id: Number(shippingAddressId),
          billing_address_id: Number(billingAddressId),
          order_items: orderItems,
        }),
      );

      if (createOrderThunk.fulfilled.match(resultAction)) {
        const newOrderId = resultAction.payload?.order?.id;
        await dispatch(clearCartThunk());
        await dispatch(fetchCartThunk());
        if (newOrderId) {
          navigate(`/account/orders/${newOrderId}`);
          return;
        }
        navigate('/account/orders');
        return;
      }

      setSubmitError(resultAction.payload || 'Failed to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Checkout</h1>

      {cartLoading && <p className="mt-4 text-sm text-muted-foreground">Loading checkout data...</p>}

      <form onSubmit={handlePlaceOrder} className="mt-6 max-w-2xl space-y-6">
        {/* Shipping Address */}
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-lg font-semibold">Shipping Address</h2>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved addresses.{' '}
              <button
                type="button"
                onClick={() => navigate('/account/addresses')}
                className="text-primary underline"
              >
                Add an address
              </button>
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                    shippingAddressId === String(addr.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingAddress"
                    value={addr.id}
                    checked={shippingAddressId === String(addr.id)}
                    onChange={(e) => setShippingAddressId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {addr.type} {addr.is_primary && <span className="text-primary">(Primary)</span>}
                    </div>
                    <div className="text-muted-foreground">
                      {addr.street}, {addr.city}, {addr.state} {addr.postal_code}
                      {addr.country && `, ${addr.country}`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Billing Address */}
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-lg font-semibold">Billing Address</h2>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={billingAddressId === shippingAddressId}
              onChange={(e) => {
                if (e.target.checked) {
                  setBillingAddressId(shippingAddressId);
                } else {
                  setBillingAddressId('');
                }
              }}
            />
            Same as shipping address
          </label>
          {billingAddressId !== shippingAddressId && addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                    billingAddressId === String(addr.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="billingAddress"
                    value={addr.id}
                    checked={billingAddressId === String(addr.id)}
                    onChange={(e) => setBillingAddressId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {addr.type} {addr.is_primary && <span className="text-primary">(Primary)</span>}
                    </div>
                    <div className="text-muted-foreground">
                      {addr.street}, {addr.city}, {addr.state} {addr.postal_code}
                      {addr.country && `, ${addr.country}`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-lg font-semibold">Payment Method</h2>
          {savedCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved payment methods.{' '}
              <button
                type="button"
                onClick={() => navigate('/account/saved-cards')}
                className="text-primary underline"
              >
                Add a card
              </button>
            </p>
          ) : (
            <div className="space-y-2">
              {savedCards.map((card) => (
                <label
                  key={card.id}
                  className={`flex cursor-pointer items-center gap-3 rounded border p-3 transition ${
                    selectedCardId === String(card.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentCard"
                    value={card.id}
                    checked={selectedCardId === String(card.id)}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {card.card_brand} •••• {card.last_four}{' '}
                      {card.is_primary && <span className="text-primary">(Primary)</span>}
                    </div>
                    <div className="text-muted-foreground">
                      Expires {card.exp_month}/{card.exp_year}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="rounded-md border bg-muted p-4">
          <h2 className="mb-2 text-lg font-semibold">Order Summary</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Items ({orderItems.length})</span>
              <span>${subtotal ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>Calculated at confirmation</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>Subtotal</span>
              <span>${subtotal ?? 0}</span>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !orderItems.length || !shippingAddressId || !billingAddressId}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Placing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}
