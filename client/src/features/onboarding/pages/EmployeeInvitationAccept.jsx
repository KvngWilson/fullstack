import { useEffect, useReducer, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Alert, Button, Card, FormField, Input } from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { employeeOnboardingService } from "@/services/employeeOnboardingService";
import { getErrorMessage } from "@/utils/getErrorMessage";

const initialForm = {
  firstName: "",
  lastName: "",
  password: "",
  confirmPassword: "",
};

export default function EmployeeInvitationAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useReducer(
    (state, action) => ({ ...state, ...action }),
    initialForm,
  );
  const [state, setState] = useState({
    loading: true,
    error: "",
    invitation: null,
    submitting: false,
    success: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setState({
          loading: false,
          error: "Invitation token is missing from the URL.",
          invitation: null,
          submitting: false,
          success: false,
        });
        return;
      }

      try {
        const response = await employeeOnboardingService.validateInvitation(token);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: "",
          invitation: response?.data || response,
          submitting: false,
          success: false,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: getErrorMessage(error, "This invitation is no longer valid."),
          invitation: null,
          submitting: false,
          success: false,
        });
      }
    }

    loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm({ [name]: value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState((current) => ({
      ...current,
      submitting: true,
      error: "",
    }));

    try {
      await employeeOnboardingService.acceptInvitation({
        token,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      setState((current) => ({
        ...current,
        submitting: false,
        success: true,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        submitting: false,
        error: getErrorMessage(error, "Failed to accept invitation."),
      }));
    }
  };

  if (state.loading) {
    return (
      <div className="landing-container section-wrap">
        <LoadingSpinner
          fullscreen={false}
          text="Validating invitation..."
          className="py-24"
        />
      </div>
    );
  }

  if (state.error && !state.invitation) {
    return (
      <div className="landing-container section-wrap">
        <ErrorState
          title="Invitation unavailable"
          message={state.error}
          retryLabel="Reload"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="landing-container section-wrap">
        <Card className="mx-auto max-w-3xl p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Employee onboarding complete
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950">
                Your employee account is ready.
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Sign in with your invited email to access the appropriate admin
                workspace for your role.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login?invitationAccepted=true" className="btn-primary">
              Continue to sign in
            </Link>
            <Link to="/" className="btn-ghost">
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="landing-container section-wrap">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
            Team invitation
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-950">
            Complete your employee setup
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Accept your invitation, create a password, and activate the internal
            tools attached to your assigned role.
          </p>

          <div className="mt-8 space-y-4">
            <Alert variant="info" title="Invited email">
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {state.invitation?.email}
              </span>
            </Alert>
            <Alert variant="success" title="Assigned role">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {state.invitation?.roleName || state.invitation?.roleCode}
              </span>
            </Alert>
            <Alert variant="warning" title="Security note">
              Invitations expire automatically if they remain unused.
            </Alert>
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          {state.error ? (
            <ErrorState
              className="mb-6"
              title="Could not finish setup"
              message={state.error}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" required>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className="pl-11"
                    placeholder="Jordan"
                    required
                  />
                </div>
              </FormField>
              <FormField label="Last name" required>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className="pl-11"
                    placeholder="Rivers"
                    required
                  />
                </div>
              </FormField>
            </div>

            <FormField label="Create password" required>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="pl-11"
                  placeholder="Choose a secure password"
                  required
                />
              </div>
            </FormField>

            <FormField label="Confirm password" required>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="pl-11"
                  placeholder="Repeat your password"
                  required
                />
              </div>
            </FormField>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={state.submitting}
            >
              Activate employee account
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
