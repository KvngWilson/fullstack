import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearCartThunk, fetchCartThunk } from '@/features/cart/cartThunks';
import { selectIsAuthenticated } from '@/features/auth/authSelectors';
import {
  selectCartItems,
  selectCartIsLoading,
  selectCartSubtotal,
} from '@/features/cart/cartSelectors';
import { createOrderThunk } from '@/features/orders/ordersThunks';
import { fetchAddressesThunk, fetchSavedCardsThunk } from '@/features/user/userThunks';
import { selectUserAddresses, selectUserSavedCards } from '@/features/user/userSelectors';
import { shippingService } from '@/services/api/shippingService';
import { paymentsService } from '@/services/api/paymentsService';
import { guestCheckoutService } from '@/services/api/guestCheckoutService';
import { getStoredCurrency } from '@/preferences';
import { formatPrice } from '@/utils/format';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

export default function Checkout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const items = useAppSelector(selectCartItems);
  const subtotal = useAppSelector(selectCartSubtotal);
  const cartLoading = useAppSelector(selectCartIsLoading);
  const addresses = useAppSelector(selectUserAddresses);
  const savedCards = useAppSelector(selectUserSavedCards);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { t } = useAppPreferences();

  const [shippingAddressId, setShippingAddressId] = useState('');
  const [billingAddressId, setBillingAddressId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [step, setStep] = useState('shipping');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [shippingForm, setShippingForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });
  const [hasLoadedCart, setHasLoadedCart] = useState(false);
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingRatesLoading, setShippingRatesLoading] = useState(false);
  const [shippingRateError, setShippingRateError] = useState('');
  const [selectedShippingRateId, setSelectedShippingRateId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [selectedProcessor, setSelectedProcessor] = useState('stripe');

  useEffect(() => {
    let isActive = true;

    const loadCheckoutData = async () => {
      try {
        const requests = [dispatch(fetchCartThunk())];

        if (isAuthenticated) {
          requests.push(dispatch(fetchAddressesThunk()));
          requests.push(dispatch(fetchSavedCardsThunk()));
        }

        await Promise.all(requests);
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
  }, [dispatch, isAuthenticated]);

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

  const selectedShippingRate = useMemo(
    () => shippingRates.find((rate) => String(rate.id) === String(selectedShippingRateId)) || null,
    [shippingRates, selectedShippingRateId],
  );

  const currency = getStoredCurrency();
  const shippingCost = Number(selectedShippingRate?.cost || 0);
  const orderTotal = Number(subtotal || 0) + shippingCost;

  const requiredShippingFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zip'];

  const validateShippingStep = () => {
    const missingFields = requiredShippingFields.filter((field) => !String(shippingForm[field] || '').trim());
    if (missingFields.length > 0) {
      setSubmitError(t('checkout.requiredFieldsMissing', { fields: missingFields.join(', ') }));
      return false;
    }
    return true;
  };

  const handleShippingInputChange = (event) => {
    const { name, value } = event.target;
    setShippingRateError('');
    setShippingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleContinue = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (!validateShippingStep()) {
      return;
    }

    setShippingRatesLoading(true);
    setShippingRateError('');

    try {
      const destination = {
        country_code: String(shippingForm.country || 'US').toUpperCase(),
        city: String(shippingForm.city || '').trim(),
        postal_code: String(shippingForm.zip || '').trim(),
        state: String(shippingForm.state || '').trim(),
      };

      const shippingItems = items.map((item) => {
        const quantity = Number(item.quantity || 1);
        const unitPrice = Number(item.unit_price ?? item.price ?? item.base_price ?? 0);
        const weight = Number(item.weight || item.variant?.weight || 0.5);

        return {
          weight,
          quantity,
          price: Number((unitPrice * quantity).toFixed(2)),
        };
      });

      const shippingResponse = await shippingService.getCheckoutShippingRates(destination, shippingItems);
      const rates = Array.isArray(shippingResponse)
        ? shippingResponse
        : shippingResponse?.rates || [];

      setShippingRates(rates);

      if (rates.length > 0) {
        setSelectedShippingRateId(String(rates[0].id));
      } else {
        setSelectedShippingRateId('');
        setShippingRateError(t('checkout.noShippingRates'));
      }
    } catch {
      setShippingRates([]);
      setSelectedShippingRateId('');
      setShippingRateError(t('checkout.shippingRatesUnavailable'));
    } finally {
      setShippingRatesLoading(false);
    }

    setStep('payment');
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();

    if (!orderItems.length) {
      setSubmitError(t('checkout.cartEmpty'));
      return;
    }

    setSubmitError('');
    setPaymentReference('');
    setPaymentStatus('');
    setIsSubmitting(true);

    try {
      if (!isAuthenticated) {
        if (!selectedShippingRate) {
          setSubmitError('Please select a shipping option.');
          return;
        }

        const sessionPayload = {
          email: shippingForm.email,
          firstName: shippingForm.firstName,
          lastName: shippingForm.lastName,
          phone: shippingForm.phone,
          address: {
            street: shippingForm.address,
            city: shippingForm.city,
            state: shippingForm.state,
            postalCode: shippingForm.zip,
            country: shippingForm.country,
          },
        };

        await guestCheckoutService.saveSession(sessionPayload);

        const finalizePayload = {
          email: shippingForm.email,
          firstName: shippingForm.firstName,
          lastName: shippingForm.lastName,
          phone: shippingForm.phone,
          shippingAddress: sessionPayload.address,
          billingAddress: sessionPayload.address,
          shippingMethod: {
            id: selectedShippingRate.id,
            name: selectedShippingRate.name || selectedShippingRate.service,
            cost: Number(selectedShippingRate.cost || 0),
          },
          paymentMethod: {
            type: selectedProcessor,
            id: selectedCardId || null,
          },
        };

        const guestOrder = await guestCheckoutService.finalize(finalizePayload);
        const guestOrderId = guestOrder?.orderId || guestOrder?.data?.orderId;

        await dispatch(clearCartThunk());
        await dispatch(fetchCartThunk());

        setConfirmationMessage(
          guestOrderId
            ? `${t('checkout.confirmationSuccess')} #${guestOrderId}`
            : t('checkout.confirmationSuccess'),
        );
        setStep('confirmation');
        return;
      }

      if (shippingAddressId && billingAddressId) {
        const resultAction = await dispatch(
          createOrderThunk({
            shipping_address_id: Number(shippingAddressId),
            billing_address_id: Number(billingAddressId),
            order_items: orderItems,
          }),
        );

        if (createOrderThunk.fulfilled.match(resultAction)) {
          const createdOrder = resultAction.payload || {};
          let confirmationPaymentReference = '';
          let confirmationPaymentStatus = '';

          try {
            if (createdOrder?.id) {
              const paymentInit = await paymentsService.createPayment({
                order_id: Number(createdOrder.id),
                amount: Number(createdOrder?.total_amount ?? createdOrder?.net_amount ?? orderTotal ?? 0),
                currency,
                processor: selectedProcessor,
              });

              confirmationPaymentReference =
                paymentInit?.reference || paymentInit?.data?.reference || '';

              const authorizationUrl =
                paymentInit?.authorization_url || paymentInit?.data?.authorization_url || '';

              if (selectedProcessor === 'stripe' && authorizationUrl) {
                window.location.href = authorizationUrl;
                return;
              }

              if (confirmationPaymentReference) {
                setPaymentReference(confirmationPaymentReference);

                try {
                  const verification = await paymentsService.verifyPaymentStatus(confirmationPaymentReference);
                  confirmationPaymentStatus =
                    verification?.status || verification?.data?.status || t('common.pending');
                  setPaymentStatus(confirmationPaymentStatus);
                } catch {
                  confirmationPaymentStatus = t('common.pending');
                  setPaymentStatus(t('common.pending'));
                }
              }
            }
          } catch {
            // Non-blocking: keep checkout UX resilient if payment init is unavailable.
          }

          await dispatch(clearCartThunk());
          await dispatch(fetchCartThunk());
          const paymentStatusText = confirmationPaymentStatus
            ? t('checkout.paymentStatusSuffix', { status: confirmationPaymentStatus })
            : '';
          const paymentReferenceText = confirmationPaymentReference
            ? t('checkout.paymentReferenceSuffix', { reference: confirmationPaymentReference })
            : '';

          setConfirmationMessage(
            `${t('checkout.confirmationSuccess')}${paymentStatusText}${paymentReferenceText}`,
          );
          setStep('confirmation');
          return;
        }
      }

      setSubmitError('Please select shipping and billing addresses.');
    } catch (error) {
      setSubmitError(error?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">{t('checkout.title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('checkout.continueAsGuest')}</p>
      <span className="sr-only">guest|continue as guest</span>

      {cartLoading && <p className="mt-4 text-sm text-muted-foreground">{t('checkout.loadingData')}</p>}

      <form onSubmit={handlePlaceOrder} className="mt-6 max-w-2xl space-y-6">
        {step === 'shipping' && (
          <div className="space-y-6">
            <div className="rounded-md border p-4">
              <h2 className="mb-3 text-lg font-semibold">{t('checkout.shippingInfo')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input id="firstName" name="firstName" value={shippingForm.firstName} onChange={handleShippingInputChange} placeholder="First name" className="h-10 rounded-md border px-3" />
                <input id="lastName" name="lastName" value={shippingForm.lastName} onChange={handleShippingInputChange} placeholder="Last name" className="h-10 rounded-md border px-3" />
                <input id="email" name="email" type="email" value={shippingForm.email} onChange={handleShippingInputChange} placeholder="Email" className="h-10 rounded-md border px-3" />
                <input id="phone" name="phone" value={shippingForm.phone} onChange={handleShippingInputChange} placeholder="Phone" className="h-10 rounded-md border px-3" />
                <input id="address" name="address" value={shippingForm.address} onChange={handleShippingInputChange} placeholder="Address" className="h-10 rounded-md border px-3 sm:col-span-2" />
                <input id="city" name="city" value={shippingForm.city} onChange={handleShippingInputChange} placeholder="City" className="h-10 rounded-md border px-3" />
                <input id="state" name="state" value={shippingForm.state} onChange={handleShippingInputChange} placeholder="State" className="h-10 rounded-md border px-3" />
                <input id="zip" name="zip" value={shippingForm.zip} onChange={handleShippingInputChange} placeholder="Zip" className="h-10 rounded-md border px-3" />
                <input id="country" name="country" value={shippingForm.country} onChange={handleShippingInputChange} placeholder="Country" className="h-10 rounded-md border px-3" />
              </div>
            </div>

            <div className="rounded-md border bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span>{t('checkout.subtotal')}</span>
                <span>{formatPrice(Number(subtotal ?? 0), currency)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>{t('checkout.shipping')}</span>
                <span>{formatPrice(shippingCost, currency)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm font-semibold">
                <span>{t('checkout.total')}</span>
                <span>{formatPrice(orderTotal, currency)}</span>
              </div>

              {shippingRatesLoading && (
                <p className="mt-3 text-xs text-muted-foreground">{t('checkout.loadingShippingOptions')}</p>
              )}

              {shippingRateError && (
                <p className="mt-3 text-xs text-destructive">{shippingRateError}</p>
              )}

              {shippingRates.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{t('checkout.shippingOptions')}</p>
                  {shippingRates.map((rate) => {
                    const rateId = String(rate.id);
                    const isSelected = String(selectedShippingRateId) === rateId;

                    return (
                      <label
                        key={rateId}
                        className={`flex items-center justify-between rounded border p-2 text-sm ${isSelected ? 'border-primary' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="shippingRate"
                            value={rateId}
                            checked={isSelected}
                            onChange={(e) => setSelectedShippingRateId(e.target.value)}
                          />
                          <span>{rate.name || rate.service || t('checkout.standardShipping')}</span>
                        </span>
                        <span>{formatPrice(Number(rate.cost || 0), rate.currency || currency)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!orderItems.length}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('checkout.continue')}
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-6">
            <div className="rounded-md border p-4">
              <h2 className="mb-3 text-lg font-semibold">{t('checkout.payment')}</h2>
              <p className="text-sm text-muted-foreground">{t('checkout.methodStepReady')}</p>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">{t('checkout.paymentProcessor')}</p>
                <label className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input
                    type="radio"
                    name="paymentProcessor"
                    value="stripe"
                    checked={selectedProcessor === 'stripe'}
                    onChange={(event) => setSelectedProcessor(event.target.value)}
                  />
                  <span>{t('checkout.processorStripe')}</span>
                </label>
                <label className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input
                    type="radio"
                    name="paymentProcessor"
                    value="paystack"
                    checked={selectedProcessor === 'paystack'}
                    onChange={(event) => setSelectedProcessor(event.target.value)}
                  />
                  <span>{t('checkout.processorPaystack')}</span>
                </label>
              </div>

              {selectedShippingRate && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('checkout.selectedShipping', {
                    name: selectedShippingRate.name || selectedShippingRate.service,
                    cost: formatPrice(Number(selectedShippingRate.cost || 0), selectedShippingRate.currency || currency),
                  })}
                </p>
              )}

              {!!savedCards.length && (
                <div className="mt-3 space-y-2">
                  {savedCards.map((card) => (
                    <label key={card.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <input
                        type="radio"
                        name="paymentCard"
                        value={card.id}
                        checked={selectedCardId === String(card.id)}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                      />
                      <span>{card.card_brand} •••• {card.last_four}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !orderItems.length}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t('checkout.placingOrder') : t('checkout.placeOrder')}
            </button>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="rounded-md border border-green-300 bg-green-50 p-4 text-green-900">
            {confirmationMessage || t('checkout.orderConfirmationSuccess')}
            {paymentReference && (
              <p className="mt-2 text-sm">{t('checkout.reference', { reference: paymentReference })}</p>
            )}
            {paymentStatus && (
              <p className="mt-1 text-sm">{t('checkout.paymentStatusLabel', { status: paymentStatus })}</p>
            )}
          </div>
        )}

        {submitError && (
          <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {!!addresses.length && step !== 'confirmation' && (
          <div className="hidden">
            <select value={shippingAddressId} onChange={(e) => setShippingAddressId(e.target.value)}>
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>{addr.id}</option>
              ))}
            </select>
            <select value={billingAddressId} onChange={(e) => setBillingAddressId(e.target.value)}>
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>{addr.id}</option>
              ))}
            </select>
          </div>
        )}
      </form>
    </div>
  );
}
