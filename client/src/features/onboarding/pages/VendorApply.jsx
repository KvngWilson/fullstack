import { useMemo, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, Store, UserRound } from "lucide-react";
import { Alert, Button, Card, FormField, Input, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import { vendorOnboardingService } from "@/services/vendorOnboardingService";
import { getErrorMessage } from "@/utils/getErrorMessage";

const initialState = {
  email: "",
  password: "",
  confirmPassword: "",
  storeName: "",
  businessType: "company",
  businessName: "",
  businessRegistration: "",
  taxId: "",
  contactPerson: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  documents: "",
};

export default function VendorApply() {
  const [form, setForm] = useReducer(
    (state, action) => ({ ...state, ...action }),
    initialState,
  );
  const [submission, setSubmission] = useState({
    loading: false,
    error: "",
    success: null,
  });

  const documentList = useMemo(
    () =>
      form.documents
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [form.documents],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm({ [name]: value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmission({ loading: true, error: "", success: null });

    try {
      const response = await vendorOnboardingService.apply({
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        storeName: form.storeName.trim(),
        businessType: form.businessType,
        businessName: form.businessName.trim(),
        businessRegistration: form.businessRegistration.trim(),
        taxId: form.taxId.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
        },
        documents: documentList,
      });

      setSubmission({
        loading: false,
        error: "",
        success: response?.data || response,
      });
    } catch (error) {
      setSubmission({
        loading: false,
        error: getErrorMessage(error, "Failed to submit vendor application."),
        success: null,
      });
    }
  };

  if (submission.success) {
    return (
      <div className="landing-container section-wrap">
        <Card className="mx-auto max-w-3xl p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Application submitted
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">
                Thanks for applying to sell on Dealport.
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                We received the application for{" "}
                <span className="font-semibold text-slate-900">
                  {submission.success.storeName}
                </span>
                . Our team will review it and contact{" "}
                <span className="font-semibold text-slate-900">
                  {submission.success.email}
                </span>{" "}
                with the next steps.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Alert variant="success" title="Application ID">
              {submission.success.applicationId}
            </Alert>
            <Alert variant="info" title="Current status">
              {submission.success.status}
            </Alert>
            <Alert variant="warning" title="Review window">
              1-3 business days
            </Alert>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/login">
              Return to sign in
            </Link>
            <Link className="btn-ghost" to="/">
              Back to storefront
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="landing-container section-wrap">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
            Marketplace onboarding
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950">
            Apply to become a Dealport vendor
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Submit your store details, compliance data, and operational contacts.
            Once approved, you will receive access to the vendor workspace and
            complete the final onboarding checklist there.
          </p>

          <div className="mt-8 grid gap-4">
            {[
              {
                icon: Store,
                title: "Store identity",
                description:
                  "Tell us about your storefront, catalog focus, and business setup.",
              },
              {
                icon: FileText,
                title: "Compliance review",
                description:
                  "Share registration, tax, and reference details for operational review.",
              },
              {
                icon: UserRound,
                title: "Launch contact",
                description:
                  "Provide the primary operator we should coordinate with during approval.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-card border border-slate-100 bg-slate-50/80 p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-950">
              Vendor application
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Complete all required fields so the review team can verify your
              store quickly.
            </p>
          </div>

          {submission.error ? (
            <ErrorState
              className="mb-6"
              title="Application failed"
              message={submission.error}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Store name" required>
                <Input
                  name="storeName"
                  value={form.storeName}
                  onChange={handleChange}
                  placeholder="Northwind Atelier"
                  required
                />
              </FormField>
              <FormField label="Business type" required>
                <select
                  name="businessType"
                  value={form.businessType}
                  onChange={handleChange}
                  className="block w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                >
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                  <option value="partnership">Partnership</option>
                  <option value="sole_proprietor">Sole proprietor</option>
                </select>
              </FormField>
            </div>

            <FormField label="Business name" required>
              <Input
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                placeholder="Northwind Atelier LLC"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Business registration">
                <Input
                  name="businessRegistration"
                  value={form.businessRegistration}
                  onChange={handleChange}
                  placeholder="REG-102938"
                />
              </FormField>
              <FormField label="Tax ID">
                <Input
                  name="taxId"
                  value={form.taxId}
                  onChange={handleChange}
                  placeholder="12-3456789"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Primary contact" required>
                <Input
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={handleChange}
                  placeholder="Jordan Rivers"
                  required
                />
              </FormField>
              <FormField label="Phone" required>
                <Input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email" required>
                <Input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="owner@example.com"
                  required
                />
              </FormField>
              <FormField label="Country" required>
                <Input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="United States"
                  required
                />
              </FormField>
            </div>

            <FormField label="Street address" required>
              <Input
                name="street"
                value={form.street}
                onChange={handleChange}
                placeholder="120 Market Street"
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="City" required>
                <Input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Austin"
                  required
                />
              </FormField>
              <FormField label="State / region" required>
                <Input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="Texas"
                  required
                />
              </FormField>
              <FormField label="Postal code" required>
                <Input
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  placeholder="78701"
                  required
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Password" required>
                <Input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  required
                />
              </FormField>
              <FormField label="Confirm password" required>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  required
                />
              </FormField>
            </div>

            <FormField
              label="Document links"
              hint="Optional. Add one document URL per line for licenses, catalogs, or compliance files."
            >
              <Textarea
                name="documents"
                value={form.documents}
                onChange={handleChange}
                rows={4}
                placeholder="https://example.com/registration.pdf"
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={submission.loading}
            >
              Submit vendor application
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already approved?{" "}
            <Link className="font-semibold text-sky-600 hover:text-sky-700" to="/login">
              Sign in to your workspace
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
