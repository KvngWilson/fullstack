import { useMemo, useState } from "react";
import AccountHeader from "@/components/layout/AccountHeader";
import { Button, Card, Input, Badge } from "@/components/ui";
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
    setCards((prev) => prev.map((card) => ({ ...card, isDefault: card.id === id })));
  };

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("savedCards.title")}
        description={t("savedCards.subtitle")}
        badge="Payment methods"
        stats={[{ label: "Saved cards", value: String(cards.length) }]}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card variant="outline">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
            {t("savedCards.listTitle")}
          </h2>

          {cards.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("savedCards.empty")}</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {cards.map((card) => (
                <li key={card.id} className="rounded-card border border-slate-100 bg-slate-50/90 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">
                        {card.brand} •••• {card.last4}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{card.holder}</p>
                      <p className="text-sm text-slate-500">
                        {t("savedCards.expires")}: {card.expiryMonth}/{card.expiryYear}
                      </p>
                    </div>
                    {card.isDefault ? (
                      <Badge variant="secondary">{t("savedCards.defaultBadge")}</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!card.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(card.id)}
                        className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                      >
                        {t("savedCards.actions.setDefault")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      className="text-sm font-semibold text-red-500 hover:text-red-600"
                    >
                      {t("savedCards.actions.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <form onSubmit={handleAddCard}>
          <Card>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
              {t("savedCards.addCard")}
            </h2>

            <div className="mt-5 grid gap-4">
              <Input
                type="text"
                name="holder"
                value={form.holder}
                onChange={onChange}
                placeholder={t("savedCards.fields.cardholder")}
                required
              />

              <Input
                type="text"
                name="number"
                value={form.number}
                onChange={onChange}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder={t("savedCards.fields.number")}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="number"
                  name="expiryMonth"
                  value={form.expiryMonth}
                  onChange={onChange}
                  min={1}
                  max={12}
                  placeholder={t("savedCards.fields.expiryMonth")}
                  required
                />
                <Input
                  type="number"
                  name="expiryYear"
                  value={form.expiryYear}
                  onChange={onChange}
                  min={new Date().getFullYear()}
                  placeholder={t("savedCards.fields.expiryYear")}
                  required
                />
              </div>

              <Input
                type="password"
                name="cvc"
                value={form.cvc}
                onChange={onChange}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={t("savedCards.fields.cvc")}
                required
              />
            </div>

            <Button type="submit" disabled={!canSubmit} className="mt-6">
              {t("savedCards.actions.save")}
            </Button>
          </Card>
        </form>
      </div>
    </div>
  );
}
