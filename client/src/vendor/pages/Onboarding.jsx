import { useEffect, useMemo, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { vendorOnboardingService } from "@/services/vendorOnboardingService";
import { getErrorMessage } from "@/utils/getErrorMessage";

const stepOrder = [
  "profile",
  "branding",
  "payment",
  "shipping",
  "policies",
  "training",
];

const stepLabels = {
  profile: "Store profile",
  branding: "Brand story",
  payment: "Payout setup",
  shipping: "Shipping settings",
  policies: "Policies",
  training: "Training confirmation",
};

function onboardingStepState(profile) {
  return {
    profile: Boolean(profile?.profile_completed),
    branding: Boolean(profile?.branding_completed),
    payment: Boolean(profile?.payment_completed),
    shipping: Boolean(profile?.shipping_completed),
    policies: Boolean(profile?.policies_completed),
    training: Boolean(profile?.training_completed),
  };
}

function nextIncompleteStep(profile) {
  const completion = onboardingStepState(profile);
  return (
    stepOrder.find((step) => !completion[step]) ||
    profile?.current_step ||
    "training"
  );
}

function initialFormFromProfile(profile) {
  const payloads = profile?.step_payloads || {};

  return {
    profile: {
      storeName: profile?.store_name || "",
      description: profile?.description || "",
    },
    branding: {
      brandStory: payloads.branding?.brandStory || "",
      supportEmail: payloads.branding?.supportEmail || profile?.email || "",
      launchGoal: payloads.branding?.launchGoal || "",
    },
    payment: {
      accountHolderName: payloads.payment?.accountHolderName || "",
      accountNumber: "",
      routingNumber: payloads.payment?.routingNumber || "",
    },
    shipping: {
      shippingRegions: payloads.shipping?.shippingRegions || "",
      handlingTimeDays: payloads.shipping?.handlingTimeDays || "2",
      returnsContact: payloads.shipping?.returnsContact || "",
    },
    policies: {
      returnWindowDays: payloads.policies?.returnWindowDays || "30",
      supportEmail: payloads.policies?.supportEmail || profile?.email || "",
      acceptsMarketplaceTerms: Boolean(
        payloads.policies?.acceptsMarketplaceTerms,
      ),
    },
    training: {
      completedTraining: Boolean(payloads.training?.completedTraining),
      launchChecklistOwner: payloads.training?.launchChecklistOwner || "",
    },
  };
}

function serializeStepPayload(step, value) {
  if (step === "policies") {
    return {
      ...value,
      acceptsMarketplaceTerms: Boolean(value.acceptsMarketplaceTerms),
    };
  }

  if (step === "training") {
    return {
      ...value,
      completedTraining: Boolean(value.completedTraining),
    };
  }

  return value;
}

export default function VendorOnboarding() {
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState({
    loading: true,
    saving: false,
    error: "",
    success: "",
  });
  const [activeStep, setActiveStep] = useState("profile");
  const [form, setForm] = useReducer(
    (current, action) => ({
      ...current,
      [action.step]: {
        ...current[action.step],
        ...action.value,
      },
    }),
    initialFormFromProfile(null),
  );

  const completion = useMemo(() => onboardingStepState(profile), [profile]);

  const refreshProfile = async () => {
    const response = await vendorOnboardingService.getMyProfile();
    const vendorProfile = response?.data || response;
    setProfile(vendorProfile);
    setForm({
      step: "profile",
      value: initialFormFromProfile(vendorProfile).profile,
    });
    setForm({
      step: "branding",
      value: initialFormFromProfile(vendorProfile).branding,
    });
    setForm({
      step: "payment",
      value: initialFormFromProfile(vendorProfile).payment,
    });
    setForm({
      step: "shipping",
      value: initialFormFromProfile(vendorProfile).shipping,
    });
    setForm({
      step: "policies",
      value: initialFormFromProfile(vendorProfile).policies,
    });
    setForm({
      step: "training",
      value: initialFormFromProfile(vendorProfile).training,
    });
    setActiveStep(
      vendorProfile?.onboarding_completed
        ? "training"
        : nextIncompleteStep(vendorProfile),
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await vendorOnboardingService.getMyProfile();
        const vendorProfile = response?.data || response;

        if (cancelled) {
          return;
        }

        setProfile(vendorProfile);
        const initialForm = initialFormFromProfile(vendorProfile);
        setForm({ step: "profile", value: initialForm.profile });
        setForm({ step: "branding", value: initialForm.branding });
        setForm({ step: "payment", value: initialForm.payment });
        setForm({ step: "shipping", value: initialForm.shipping });
        setForm({ step: "policies", value: initialForm.policies });
        setForm({ step: "training", value: initialForm.training });
        setActiveStep(
          vendorProfile?.onboarding_completed
            ? "training"
            : nextIncompleteStep(vendorProfile),
        );
        setState({
          loading: false,
          saving: false,
          error: "",
          success: "",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          saving: false,
          error: getErrorMessage(error, "Failed to load onboarding."),
          success: "",
        });
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFieldChange = (step, event) => {
    const { name, value, type, checked } = event.target;
    setForm({
      step,
      value: {
        [name]: type === "checkbox" ? checked : value,
      },
    });
  };

  const handleSaveStep = async (step) => {
    setState((current) => ({
      ...current,
      saving: true,
      error: "",
      success: "",
    }));

    try {
      await vendorOnboardingService.saveOnboardingStep(
        step,
        serializeStepPayload(step, form[step]),
      );
      await refreshProfile();
      setState((current) => ({
        ...current,
        loading: false,
        saving: false,
        error: "",
        success:
          step === "training"
            ? "Vendor onboarding completed. Your workspace is now fully active."
            : `${stepLabels[step]} saved successfully.`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        error: getErrorMessage(error, "Failed to save onboarding step."),
        success: "",
      }));
    }
  };

  if (state.loading) {
    return (
      <div className="landing-container section-wrap">
        <LoadingSpinner
          fullscreen={false}
          text="Preparing vendor onboarding..."
          className="py-24"
        />
      </div>
    );
  }

  if (state.error && !profile) {
    return (
      <div className="landing-container section-wrap">
        <ErrorState
          title="Onboarding unavailable"
          message={state.error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="landing-container section-wrap">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-6">
          <Badge variant="secondary">Vendor onboarding</Badge>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-950">
            Launch your store
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Complete the remaining setup items to unlock the full vendor
            workspace.
          </p>

          <div className="mt-6 space-y-3">
            {stepOrder.map((step, index) => {
              const done = completion[step];
              const isActive = activeStep === step;

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(step)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-sky-200 bg-sky-50/70"
                      : "border-slate-200/70 bg-white/80 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {stepLabels[step]}
                    </p>
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            <Alert
              variant={profile?.onboarding_completed ? "success" : "info"}
              title="Current step"
            >
              {profile?.onboarding_completed
                ? "Complete"
                : stepLabels[profile?.current_step] || stepLabels[activeStep]}
            </Alert>
            {profile?.bank_account_last4 ? (
              <Alert variant="warning" title="Payout account on file">
                Ending in {profile.bank_account_last4}
              </Alert>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          {state.error ? (
            <ErrorState
              className="mb-6"
              title="Could not save onboarding"
              message={state.error}
            />
          ) : null}
          {state.success ? (
            <Alert variant="success" title="Saved" className="mb-6">
              {state.success}
            </Alert>
          ) : null}

          {activeStep === "profile" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Store profile
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Confirm your customer-facing store identity before launch.
                </p>
              </div>
              <FormField label="Store name" required>
                <Input
                  name="storeName"
                  value={form.profile.storeName}
                  onChange={(event) => handleFieldChange("profile", event)}
                />
              </FormField>
              <FormField label="Store description" required>
                <Textarea
                  name="description"
                  rows={6}
                  value={form.profile.description}
                  onChange={(event) => handleFieldChange("profile", event)}
                />
              </FormField>
            </div>
          ) : null}

          {activeStep === "branding" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Brand story
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Capture your value proposition and primary launch goal.
                </p>
              </div>
              <FormField label="Brand story" required>
                <Textarea
                  name="brandStory"
                  rows={5}
                  value={form.branding.brandStory}
                  onChange={(event) => handleFieldChange("branding", event)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Support email" required>
                  <Input
                    type="email"
                    name="supportEmail"
                    value={form.branding.supportEmail}
                    onChange={(event) => handleFieldChange("branding", event)}
                  />
                </FormField>
                <FormField label="Launch goal" required>
                  <Input
                    name="launchGoal"
                    value={form.branding.launchGoal}
                    onChange={(event) => handleFieldChange("branding", event)}
                    placeholder="Launch 40 SKUs in the first 30 days"
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          {activeStep === "payment" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Payout setup
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Add the account details we should use for marketplace payouts.
                </p>
              </div>
              <FormField label="Account holder name" required>
                <Input
                  name="accountHolderName"
                  value={form.payment.accountHolderName}
                  onChange={(event) => handleFieldChange("payment", event)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Account number" required>
                  <Input
                    name="accountNumber"
                    value={form.payment.accountNumber}
                    onChange={(event) => handleFieldChange("payment", event)}
                    placeholder="Enter full account number"
                  />
                </FormField>
                <FormField label="Routing number" required>
                  <Input
                    name="routingNumber"
                    value={form.payment.routingNumber}
                    onChange={(event) => handleFieldChange("payment", event)}
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          {activeStep === "shipping" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Shipping settings
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Define where you ship and how quickly you fulfill orders.
                </p>
              </div>
              <FormField label="Shipping regions" required>
                <Textarea
                  name="shippingRegions"
                  rows={4}
                  value={form.shipping.shippingRegions}
                  onChange={(event) => handleFieldChange("shipping", event)}
                  placeholder="United States, Canada, United Kingdom"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Handling time (days)" required>
                  <Input
                    type="number"
                    min="0"
                    name="handlingTimeDays"
                    value={form.shipping.handlingTimeDays}
                    onChange={(event) => handleFieldChange("shipping", event)}
                  />
                </FormField>
                <FormField label="Returns contact" required>
                  <Input
                    name="returnsContact"
                    value={form.shipping.returnsContact}
                    onChange={(event) => handleFieldChange("shipping", event)}
                    placeholder="returns@example.com"
                  />
                </FormField>
              </div>
            </div>
          ) : null}

          {activeStep === "policies" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Marketplace policies
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Capture the support and returns standards your store will
                  follow.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Return window (days)" required>
                  <Input
                    type="number"
                    min="0"
                    name="returnWindowDays"
                    value={form.policies.returnWindowDays}
                    onChange={(event) => handleFieldChange("policies", event)}
                  />
                </FormField>
                <FormField label="Support email" required>
                  <Input
                    type="email"
                    name="supportEmail"
                    value={form.policies.supportEmail}
                    onChange={(event) => handleFieldChange("policies", event)}
                  />
                </FormField>
              </div>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="acceptsMarketplaceTerms"
                  checked={form.policies.acceptsMarketplaceTerms}
                  onChange={(event) => handleFieldChange("policies", event)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                />
                <span>
                  I confirm this store accepts Dealport marketplace operating
                  terms and policy enforcement.
                </span>
              </label>
            </div>
          ) : null}

          {activeStep === "training" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-950">
                  Training and launch readiness
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Confirm your team reviewed the operating checklist before
                  launch.
                </p>
              </div>
              <FormField label="Launch checklist owner" required>
                <Input
                  name="launchChecklistOwner"
                  value={form.training.launchChecklistOwner}
                  onChange={(event) => handleFieldChange("training", event)}
                  placeholder="Jordan Rivers"
                />
              </FormField>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="completedTraining"
                  checked={form.training.completedTraining}
                  onChange={(event) => handleFieldChange("training", event)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                />
                <span>
                  I confirm the store team completed internal launch training
                  and is ready to go live.
                </span>
              </label>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              loading={state.saving}
              onClick={() => handleSaveStep(activeStep)}
            >
              {activeStep === "training"
                ? "Finish onboarding"
                : "Save and continue"}
            </Button>
            {profile?.onboarding_completed ? (
              <Link to="/vendor" className="btn-ghost">
                Go to vendor workspace
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
