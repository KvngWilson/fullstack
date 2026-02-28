import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  addSavedCardThunk,
  deleteSavedCardThunk,
  fetchSavedCardsThunk,
  setPrimaryCardThunk,
} from '@/features/user/userThunks';
import {
  selectUserError,
  selectUserIsLoading,
  selectUserSavedCards,
} from '@/features/user/userSelectors';

const initialCard = {
  card_brand: 'visa',
  last_four: '',
  exp_month: '',
  exp_year: '',
  card_token: '',
  is_primary: false,
};

export default function SavedCards() {
  const dispatch = useAppDispatch();
  const savedCards = useAppSelector(selectUserSavedCards);
  const isLoading = useAppSelector(selectUserIsLoading);
  const error = useAppSelector(selectUserError);
  const [form, setForm] = useState(initialCard);

  useEffect(() => {
    dispatch(fetchSavedCardsThunk());
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
    dispatch(addSavedCardThunk({
      ...form,
      exp_month: Number(form.exp_month),
      exp_year: Number(form.exp_year),
    })).then(() => setForm(initialCard));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Saved Cards</h1>

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Brand</label>
            <input
              name="card_brand"
              value={form.card_brand}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              placeholder="visa"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Last 4</label>
            <input
              name="last_four"
              value={form.last_four}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              maxLength={4}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Exp Month</label>
            <input
              name="exp_month"
              value={form.exp_month}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Exp Year</label>
            <input
              name="exp_year"
              value={form.exp_year}
              onChange={handleChange}
              className="h-10 w-full rounded-md border px-3"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Card Token</label>
            <input
              name="card_token"
              value={form.card_token}
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
          Save Card
        </button>
      </form>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading cards...</p>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 space-y-3">
        {savedCards.map((card) => (
          <div key={card.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium uppercase">{card.card_brand || 'card'}</p>
                <p className="text-sm text-muted-foreground">
                  **** **** **** {card.last_four} · {card.exp_month}/{card.exp_year}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!card.is_primary && (
                  <button
                    type="button"
                    onClick={() => dispatch(setPrimaryCardThunk(card.id))}
                    className="text-sm text-primary"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dispatch(deleteSavedCardThunk(card.id))}
                  className="text-sm text-destructive"
                >
                  Delete
                </button>
              </div>
            </div>
            {card.is_primary && (
              <p className="mt-2 text-xs font-semibold text-primary">Primary</p>
            )}
          </div>
        ))}
        {!savedCards.length && !isLoading && (
          <p className="text-sm text-muted-foreground">No saved cards.</p>
        )}
      </div>
    </div>
  );
}
