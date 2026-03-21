import { useMemo, useState } from "react";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

const INITIAL_CARDS = [
  {
    id: 1,
    brand: "Visa",
    holder: "Alex Johnson",
    last4: "4242",
    expiryMonth: "10",
    expiryYear: "2028",
    isDefault: true,
  },
];

const EMPTY_FORM = {
  holder: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  cvc: "",
};

function normalizeBrand(number = "") {
  if (number.startsWith("4")) return "Visa";
  if (number.startsWith("5")) return "Mastercard";
  if (number.startsWith("3")) return "Amex";
  return "Card";
}

function maskLast4(number = "") {
  const digits = number.replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

export default function SavedCards() {
  const { t } = useAppPreferences();
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(() => {
    return (
      form.holder.trim() &&
      form.number.replace(/\D/g, "").length >= 12 &&
      Number(form.expiryMonth) >= 1 &&
      Number(form.expiryMonth) <= 12 &&
      Number(form.expiryYear) >= new Date().getFullYear() &&
      form.cvc.replace(/\D/g, "").length >= 3
    );
  }, [form]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => setForm(EMPTY_FORM);

  const handleAddCard = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const newCard = {
      id: Date.now(),
      brand: normalizeBrand(form.number),
      holder: form.holder.trim(),
      last4: maskLast4(form.number),
      expiryMonth: String(form.expiryMonth).padStart(2, "0"),
      expiryYear: String(form.expiryYear),
      isDefault: cards.length === 0,
    };

    setCards((prev) => [...prev, newCard]);
    resetForm();
  };

  const handleDelete = (id) => {
    setCards((prev) => {
      const updated = prev.filter((card) => card.id !== id);
      if (updated.length && !updated.some((card) => card.isDefault)) {
        updated[0] = { ...updated[0], isDefault: true };
      }
      return [...updated];
    });
  };

  const handleSetDefault = (id) => {
    setCards((prev) =>
      prev.map((card) => ({ ...card, isDefault: card.id === id })),
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t("savedCards.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("savedCards.subtitle")}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t("savedCards.listTitle")}</h2>

          {cards.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("savedCards.empty")}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {cards.map((card) => (
                <li
                  key={card.id}
                  className="rounded-md border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {card.brand} •••• {card.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {card.holder}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("savedCards.expires")}: {card.expiryMonth}/
                        {card.expiryYear}
                      </p>
                    </div>
                    {card.isDefault ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {t("savedCards.defaultBadge")}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    {!card.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(card.id)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t("savedCards.actions.setDefault")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      className="text-sm font-medium text-destructive hover:underline"
                    >
                      {t("savedCards.actions.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          onSubmit={handleAddCard}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold">{t("savedCards.addCard")}</h2>

          <div className="mt-5 grid gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">
                {t("savedCards.fields.cardholder")}
              </span>
              <input
                type="text"
                name="holder"
                value={form.holder}
                onChange={onChange}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">
                {t("savedCards.fields.number")}
              </span>
              <input
                type="text"
                name="number"
                value={form.number}
                onChange={onChange}
                inputMode="numeric"
                autoComplete="cc-number"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium">
                  {t("savedCards.fields.expiryMonth")}
                </span>
                <input
                  type="number"
                  name="expiryMonth"
                  value={form.expiryMonth}
                  onChange={onChange}
                  min={1}
                  max={12}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">
                  {t("savedCards.fields.expiryYear")}
                </span>
                <input
                  type="number"
                  name="expiryYear"
                  value={form.expiryYear}
                  onChange={onChange}
                  min={new Date().getFullYear()}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium">
                {t("savedCards.fields.cvc")}
              </span>
              <input
                type="password"
                name="cvc"
                value={form.cvc}
                onChange={onChange}
                inputMode="numeric"
                autoComplete="cc-csc"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("savedCards.actions.save")}
          </button>
        </form>
      </div>
    </div>
  );
}
