import { useState } from "react";
import AccountHeader from "@/components/layout/AccountHeader";
import { Button, Card, Input } from "@/components/ui";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

const initialAddress = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
};

export default function Addresses() {
  const { t } = useAppPreferences();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(initialAddress);
  const [editingId, setEditingId] = useState(null);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(initialAddress);
    setEditingId(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (editingId) {
      setAddresses((prev) =>
        prev.map((address) =>
          address.id === editingId
            ? {
                ...address,
                ...form,
              }
            : address,
        ),
      );
      resetForm();
      return;
    }

    setAddresses((prev) => [
      ...prev,
      {
        id: Date.now(),
        ...form,
      },
    ]);
    resetForm();
  };

  const handleEdit = (address) => {
    setEditingId(address.id);
    setForm({
      fullName: address.fullName,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    });
  };

  const handleDelete = (addressId) => {
    setAddresses((prev) => prev.filter((address) => address.id !== addressId));
    if (editingId === addressId) {
      resetForm();
    }
  };

  return (
    <div className="landing-container section-wrap">
      <AccountHeader
        title={t("addresses.title")}
        description={t("addresses.subtitle")}
        badge="Delivery details"
        stats={[{ label: "Saved addresses", value: String(addresses.length) }]}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit}>
          <Card>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
              {editingId ? t("addresses.editAddress") : t("addresses.addAddress")}
            </h2>

            <div className="mt-5 grid gap-4">
              <Input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={onChange}
                placeholder={t("addresses.fields.fullName")}
                required
              />
              <Input
                type="text"
                name="line1"
                value={form.line1}
                onChange={onChange}
                placeholder={t("addresses.fields.line1")}
                required
              />
              <Input
                type="text"
                name="line2"
                value={form.line2}
                onChange={onChange}
                placeholder={t("addresses.fields.line2")}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={onChange}
                  placeholder={t("addresses.fields.city")}
                  required
                />
                <Input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={onChange}
                  placeholder={t("addresses.fields.state")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="text"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={onChange}
                  placeholder={t("addresses.fields.postalCode")}
                  required
                />
                <Input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={onChange}
                  placeholder={t("addresses.fields.country")}
                  required
                />
              </div>

              <Input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={onChange}
                placeholder={t("addresses.fields.phone")}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="submit">
                {editingId ? t("addresses.actions.update") : t("addresses.actions.save")}
              </Button>
              {editingId ? (
                <Button type="button" onClick={resetForm} variant="ghost">
                  {t("addresses.actions.cancel")}
                </Button>
              ) : null}
            </div>
          </Card>
        </form>

        <Card variant="outline">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
            {t("addresses.savedAddresses")}
          </h2>

          {addresses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("addresses.empty")}</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {addresses.map((address) => (
                <li key={address.id} className="rounded-card border border-slate-100 bg-slate-50/90 p-4">
                  <p className="font-medium text-slate-950">{address.fullName}</p>
                  <p className="mt-2 text-sm text-slate-500">{address.line1}</p>
                  {address.line2 ? <p className="text-sm text-slate-500">{address.line2}</p> : null}
                  <p className="text-sm text-slate-500">
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className="text-sm text-slate-500">{address.country}</p>
                  {address.phone ? <p className="text-sm text-slate-500">{address.phone}</p> : null}

                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(address)}
                      className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                    >
                      {t("addresses.actions.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(address.id)}
                      className="text-sm font-semibold text-red-500 hover:text-red-600"
                    >
                      {t("addresses.actions.delete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
