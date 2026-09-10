import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { vendorOnboardingService } from "@/services/vendorOnboardingService";
import { getErrorMessage } from "@/utils/getErrorMessage";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "incomplete", label: "Needs info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function StatCard({ label, value, helper }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 font-heading text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </Card>
  );
}

export default function Vendors() {
  const [filters, setFilters] = useState({ status: "", search: "" });
  const [state, setState] = useState({
    loading: true,
    error: "",
    applications: [],
    selected: null,
    detailLoading: false,
    actionLoading: false,
    actionError: "",
    reviewNote: "",
  });

  const loadApplications = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const response = await vendorOnboardingService.listApplications({
        status: filters.status || undefined,
        search: filters.search || undefined,
        pageSize: 50,
      });

      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        applications: response?.data || response || [],
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error, "Failed to load vendor applications."),
      }));
    }
  }, [filters.search, filters.status]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const counts = useMemo(() => {
    const applications = state.applications;
    return {
      total: applications.length,
      pending: applications.filter((item) => item.status === "pending").length,
      incomplete: applications.filter((item) => item.status === "incomplete")
        .length,
      approved: applications.filter((item) => item.status === "approved").length,
    };
  }, [state.applications]);

  const filteredApplications = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    if (!query) {
      return state.applications;
    }

    return state.applications.filter((application) =>
      [application.store_name, application.email, application.contact_person]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [filters.search, state.applications]);

  const openApplication = async (applicationId) => {
    setState((current) => ({
      ...current,
      detailLoading: true,
      actionError: "",
      reviewNote: "",
    }));

    try {
      const response = await vendorOnboardingService.getApplication(applicationId);
      const selected = response?.data || response;
      setState((current) => ({
        ...current,
        detailLoading: false,
        selected,
        reviewNote: selected?.admin_notes || selected?.rejection_reason || "",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        detailLoading: false,
        actionError: getErrorMessage(
          error,
          "Failed to load application details.",
        ),
      }));
    }
  };

  const runAction = async (action) => {
    if (!state.selected?.id) {
      return;
    }

    setState((current) => ({
      ...current,
      actionLoading: true,
      actionError: "",
    }));

    try {
      if (action === "approve") {
        await vendorOnboardingService.approveApplication(state.selected.id, {
          notes: state.reviewNote,
        });
      }

      if (action === "reject") {
        await vendorOnboardingService.rejectApplication(state.selected.id, {
          reason: state.reviewNote,
        });
      }

      if (action === "request-info") {
        await vendorOnboardingService.requestMoreInfo(state.selected.id, {
          message: state.reviewNote,
        });
      }

      await loadApplications();
      await openApplication(state.selected.id);

      setState((current) => ({
        ...current,
        actionLoading: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        actionLoading: false,
        actionError: getErrorMessage(error, "Unable to update application."),
      }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Vendor onboarding</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Review and activate marketplace vendors
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Process inbound vendor applications, request missing information, and
          approve qualified merchants into the marketplace workflow.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications" value={counts.total} helper="Loaded for current filter set" />
        <StatCard label="Pending review" value={counts.pending} helper="Ready for triage" />
        <StatCard label="Needs info" value={counts.incomplete} helper="Waiting on applicant updates" />
        <StatCard label="Approved" value={counts.approved} helper="Already converted to vendors" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search applications
              </label>
              <Input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search by store, email, or contact"
              />
            </div>
            <div className="w-full lg:w-56">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <Select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={loadApplications}>
              Refresh
            </Button>
          </div>

          {state.error ? (
            <ErrorState
              className="mt-6"
              title="Could not load applications"
              message={state.error}
              onRetry={loadApplications}
            />
          ) : null}

          {state.loading ? (
            <LoadingSpinner
              fullscreen={false}
              text="Loading vendor applications..."
              className="py-16"
            />
          ) : null}

          {!state.loading && !filteredApplications.length ? (
            <EmptyState
              className="mt-6"
              title="No vendor applications found"
              message="Try adjusting your filters or wait for new submissions."
            />
          ) : null}

          {!state.loading && filteredApplications.length ? (
            <div className="mt-6 space-y-4">
              {filteredApplications.map((application) => (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => openApplication(application.id)}
                  className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                    state.selected?.id === application.id
                      ? "border-sky-200 bg-sky-50/70"
                      : "border-slate-200/70 bg-white/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {application.store_name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {application.contact_person} • {application.email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        application.status === "approved"
                          ? "success"
                          : application.status === "rejected"
                            ? "error"
                            : application.status === "incomplete"
                              ? "accent"
                              : "secondary"
                      }
                    >
                      {application.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-950">
            Review details
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Select an application to inspect the submission and take action.
          </p>

          {state.detailLoading ? (
            <LoadingSpinner
              fullscreen={false}
              text="Loading application..."
              className="py-16"
            />
          ) : null}

          {!state.detailLoading && !state.selected ? (
            <EmptyState
              className="mt-6"
              title="No application selected"
              message="Choose a vendor application from the list to review it."
            />
          ) : null}

          {state.selected ? (
            <div className="mt-6 space-y-4">
              <Alert variant="info" title="Applicant">
                {state.selected.contact_person} • {state.selected.email}
              </Alert>
              <Alert variant="info" title="Business">
                {state.selected.business_name || state.selected.store_name}
              </Alert>
              <Alert variant="info" title="Status">
                {state.selected.status}
              </Alert>

              <div className="rounded-card border border-slate-200/70 bg-slate-50/60 p-4 text-sm leading-6 text-slate-600">
                <p><span className="font-semibold text-slate-900">Store:</span> {state.selected.store_name}</p>
                <p><span className="font-semibold text-slate-900">Type:</span> {state.selected.business_type}</p>
                <p><span className="font-semibold text-slate-900">Phone:</span> {state.selected.phone}</p>
                <p><span className="font-semibold text-slate-900">Registration:</span> {state.selected.business_registration || "N/A"}</p>
                <p><span className="font-semibold text-slate-900">Tax ID:</span> {state.selected.tax_id || "N/A"}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Review note
                </label>
                <Textarea
                  rows={6}
                  value={state.reviewNote}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      reviewNote: event.target.value,
                    }))
                  }
                  placeholder="Add approval notes, a rejection reason, or missing information request."
                />
              </div>

              {state.actionError ? (
                <ErrorState
                  title="Action failed"
                  message={state.actionError}
                />
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="success"
                  loading={state.actionLoading}
                  onClick={() => runAction("approve")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="warning"
                  loading={state.actionLoading}
                  onClick={() => runAction("request-info")}
                >
                  Request info
                </Button>
                <Button
                  type="button"
                  variant="error"
                  loading={state.actionLoading}
                  onClick={() => runAction("reject")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
