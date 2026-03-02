import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  addAddressThunk,
  deleteAddressThunk,
  fetchAddressesThunk,
} from '@/features/user/userThunks';
import {
  selectUserAddresses,
  selectUserError,
  selectUserIsLoading,
} from '@/features/user/userSelectors';
import { EmptyState, ErrorState } from '@/components/common/AsyncState';
import { TextBlockSkeleton } from '@/components/common/Skeleton';

const initialForm = {
  type: 'shipping',
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  is_primary: false,
};

export default function Addresses() {
  const dispatch = useAppDispatch();
  const addresses = useAppSelector(selectUserAddresses);
  const isLoading = useAppSelector(selectUserIsLoading);
  const error = useAppSelector(selectUserError);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    dispatch(fetchAddressesThunk());
  }, [dispatch]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(addAddressThunk(form)).then(() => setForm(initialForm));
  };

  const handleDelete = (addressId) => {
    dispatch(deleteAddressThunk(addressId));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Addresses</h1>

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
            >
              <option value="shipping">Shipping</option>
              <option value="billing">Billing</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Street</label>
            <input
              name="street"
              value={form.street}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">City</label>
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">State</label>
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Postal Code</label>
            <input
              name="postal_code"
              value={form.postal_code}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Country</label>
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            name="is_primary"
            checked={form.is_primary}
            onChange={handleChange}
            className="h-4 w-4"
          />
          <span className="text-sm">Set as primary</span>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Add Address
        </button>
      </form>

      {isLoading && (
        <div className="mt-4">
          <TextBlockSkeleton />
        </div>
      )}
      {error && <ErrorState className="mt-4" title="Failed to load addresses" message={error} onRetry={() => dispatch(fetchAddressesThunk())} />}

      <div className="mt-6 space-y-3">
        {addresses.map((address) => (
          <div key={address.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium capitalize">{address.type} address</p>
                <p className="text-sm text-muted-foreground">
                  {address.street}, {address.city}, {address.state} {address.postal_code}
                </p>
                <p className="text-sm text-muted-foreground">{address.country}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(address.id)}
                className="text-sm text-destructive"
              >
                Delete
              </button>
            </div>
            {address.is_primary && (
              <p className="mt-2 text-xs font-semibold text-primary">Primary</p>
            )}
          </div>
        ))}
        {!addresses.length && !isLoading && (
          <EmptyState
            title="No saved addresses"
            message="Add a shipping or billing address to speed up checkout."
          />
        )}
      </div>
    </div>
  );
}
