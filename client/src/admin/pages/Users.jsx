import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { employeeOnboardingService } from "@/services/employeeOnboardingService";
import { adminPortalApi } from "@/api/endpoints/adminPortal";
import { getErrorMessage } from "@/utils/getErrorMessage";

function SectionHeader({ title, description }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

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

function statusBadgeVariant(status) {
  if (status === "active") {
    return "success";
  }
  if (status === "pending") {
    return "accent";
  }
  if (status === "suspended" || status === "terminated") {
    return "error";
  }
  return "secondary";
}

export default function Users() {
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSummary, setCustomerSummary] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: "", roleId: "" });
  const [state, setState] = useState({
    loading: true,
    inviting: false,
    customerActionId: null,
    error: "",
    inviteError: "",
    inviteSuccess: "",
  });

  const employeeRoleOptions = useMemo(
    () =>
      roles.filter(
        (role) =>
          !["customer", "vendor"].includes(
            String(role.code || "").toLowerCase(),
          ),
      ),
    [roles],
  );

  const loadData = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
    const [
      rolesResponse,
      employeesResponse,
      invitationsResponse,
      customersResponse,
    ] =
      await Promise.all([
        employeeOnboardingService.listRoles({ includeSystem: true }),
        employeeOnboardingService.listEmployees({ pageSize: 50 }),
        employeeOnboardingService.listPendingInvitations({ pageSize: 50 }),
        adminPortalApi.listCustomers({ pageSize: 25 }),
      ]);

    setRoles(rolesResponse || []);
      setEmployees(
        employeesResponse?.data || employeesResponse?.employees || [],
      );
      setInvitations(invitationsResponse?.data || invitationsResponse || []);
      setCustomers(customersResponse?.data?.users || []);
      setCustomerSummary(customersResponse?.data?.summary || null);
      setState((current) => ({
        ...current,
        loading: false,
        error: "",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(
          error,
          "Failed to load employee onboarding data.",
        ),
      }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(
    () => ({
      employees: employees.length,
      invitations: invitations.length,
      privilegedRoles: employeeRoleOptions.length,
      activeEmployees: employees.filter(
        (employee) => employee.employment_status === "active",
      ).length,
    }),
    [employeeRoleOptions.length, employees, invitations.length],
  );

  const handleInvite = async (event) => {
    event.preventDefault();
    setState((current) => ({
      ...current,
      inviting: true,
      inviteError: "",
      inviteSuccess: "",
    }));

    try {
      await employeeOnboardingService.inviteEmployee({
        email: inviteForm.email.trim(),
        roleId: Number(inviteForm.roleId),
      });

      setInviteForm({ email: "", roleId: "" });
      setState((current) => ({
        ...current,
        inviting: false,
        inviteSuccess: "Employee invitation sent successfully.",
      }));
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        inviting: false,
        inviteError: getErrorMessage(error, "Failed to send invitation."),
      }));
    }
  };

  const updateEmployeeRole = async (employeeId, roleId) => {
    try {
      await employeeOnboardingService.updateEmployeeRole(employeeId, {
        roleId: Number(roleId),
        reason: "Updated from admin users onboarding screen",
      });
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: getErrorMessage(error, "Failed to update employee role."),
      }));
    }
  };

  const updateEmployeeStatus = async (employeeId, status) => {
    try {
      await employeeOnboardingService.updateEmployeeStatus(employeeId, {
        status,
        reason: "Updated from admin users onboarding screen",
      });
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: getErrorMessage(error, "Failed to update employee status."),
      }));
    }
  };

  const resendInvitation = async (invitationId) => {
    try {
      await employeeOnboardingService.resendInvitation(invitationId);
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        error: getErrorMessage(error, "Failed to resend invitation."),
      }));
    }
  };

  const updateCustomerRole = async (userId, role) => {
    setState((current) => ({
      ...current,
      customerActionId: `role-${userId}`,
      error: "",
    }));

    try {
      await adminPortalApi.updateCustomerRole(userId, { role });
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        customerActionId: null,
        error: getErrorMessage(error, "Failed to update customer role."),
      }));
      return;
    }

    setState((current) => ({
      ...current,
      customerActionId: null,
    }));
  };

  const deleteCustomer = async (userId) => {
    setState((current) => ({
      ...current,
      customerActionId: `delete-${userId}`,
      error: "",
    }));

    try {
      await adminPortalApi.deleteCustomer(userId);
      await loadData();
    } catch (error) {
      setState((current) => ({
        ...current,
        customerActionId: null,
        error: getErrorMessage(error, "Failed to delete customer."),
      }));
      return;
    }

    setState((current) => ({
      ...current,
      customerActionId: null,
    }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Employee onboarding</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Invite, activate, and govern internal teams
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Provision staff accounts, resend invitations, and keep employee roles
          aligned with the operational surfaces they should access.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Employees"
          value={stats.employees}
          helper="Visible active employee records"
        />
        <StatCard
          label="Pending invites"
          value={stats.invitations}
          helper="Awaiting acceptance"
        />
        <StatCard
          label="Assignable roles"
          value={stats.privilegedRoles}
          helper="Available role templates"
        />
        <StatCard
          label="Active staff"
          value={stats.activeEmployees}
          helper="Currently active team members"
        />
      </section>

      {state.error ? (
        <ErrorState
          className="mt-6"
          title="Could not load onboarding data"
          message={state.error}
          onRetry={loadData}
        />
      ) : null}

      {state.loading ? (
        <LoadingSpinner
          fullscreen={false}
          text="Loading employee onboarding..."
          className="py-16"
        />
      ) : null}

      {!state.loading ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="p-6">
            <SectionHeader
              title="Invite employee"
              description="Send an invitation that routes the recipient into the frontend acceptance flow."
            />

            {state.inviteError ? (
              <ErrorState
                className="mt-6"
                title="Invitation failed"
                message={state.inviteError}
              />
            ) : null}

            {state.inviteSuccess ? (
              <div className="mt-6 rounded-card border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                {state.inviteSuccess}
              </div>
            ) : null}

            <form onSubmit={handleInvite} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Work email
                </label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="new-hire@dealport.test"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Role
                </label>
                <Select
                  value={inviteForm.roleId}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      roleId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select a role</option>
                  {employeeRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.code})
                    </option>
                  ))}
                </Select>
              </div>

              <Button type="submit" className="w-full" loading={state.inviting}>
                Send invitation
              </Button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <SectionHeader
                title="Pending invitations"
                description="Resend invitations if a teammate needs a fresh activation email."
              />

              {!invitations.length ? (
                <EmptyState
                  className="mt-6"
                  title="No pending invitations"
                  message="All employee invitations have either been accepted or none have been sent yet."
                />
              ) : (
                <div className="mt-6 space-y-4">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-3xl border border-slate-200/70 bg-white/80 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {invitation.email}
                          </p>
                          <p className="text-sm text-slate-500">
                            {invitation.role_name || invitation.role_code}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={statusBadgeVariant(invitation.status)}
                          >
                            {invitation.status}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                          >
                            Resend
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <SectionHeader
                title="Employee directory"
                description="Adjust assigned roles or employment status after activation."
              />

              {!employees.length ? (
                <EmptyState
                  className="mt-6"
                  title="No employees found"
                  message="Employee records will appear here once invitations are accepted."
                />
              ) : (
                <div className="mt-6 space-y-4">
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="rounded-3xl border border-slate-200/70 bg-white/80 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {[employee.first_name, employee.last_name]
                              .filter(Boolean)
                              .join(" ") || employee.email}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {employee.email}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge
                            variant={statusBadgeVariant(
                              employee.employment_status,
                            )}
                          >
                            {employee.employment_status}
                          </Badge>
                          <Select
                            value={employee.role_id || employee.roleId || ""}
                            onChange={(event) =>
                              updateEmployeeRole(
                                employee.id,
                                event.target.value,
                              )
                            }
                            className="min-w-48"
                          >
                            {employeeRoleOptions.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={employee.employment_status}
                            onChange={(event) =>
                              updateEmployeeStatus(
                                employee.id,
                                event.target.value,
                              )
                            }
                            className="min-w-40"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="on_leave">On leave</option>
                            <option value="suspended">Suspended</option>
                            <option value="terminated">Terminated</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <SectionHeader
                title="Marketplace customer accounts"
                description="This section now carries the live customer management and role controls that previously lived in the SSR admin."
              />

              <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Customers"
                  value={customerSummary?.total || 0}
                  helper="Total registered accounts"
                />
                <StatCard
                  label="Active recently"
                  value={customerSummary?.active || 0}
                  helper="Logged in within 7 days"
                />
                <StatCard
                  label="New in 30 days"
                  value={customerSummary?.new_last_30 || 0}
                  helper="Recently created accounts"
                />
                <StatCard
                  label="Admins"
                  value={customerSummary?.admins || 0}
                  helper="Accounts with admin role"
                />
              </section>

              {!customers.length ? (
                <EmptyState
                  className="mt-6"
                  title="No customer accounts loaded"
                  message="Customer records will appear here once users register."
                />
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Role
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Created
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Last login
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {customers.map((customer) => (
                        <tr key={customer.id}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {customer.email}
                              </p>
                              <p className="text-xs text-slate-500">
                                #{customer.id}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={customer.role}
                              disabled={Boolean(state.customerActionId)}
                              onChange={(event) =>
                                updateCustomerRole(
                                  customer.id,
                                  event.target.value,
                                )
                              }
                            >
                              <option value="customer">customer</option>
                              <option value="vendor">vendor</option>
                              <option value="admin">admin</option>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {customer.created_at
                              ? new Date(customer.created_at).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {customer.last_login
                              ? new Date(customer.last_login).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={state.customerActionId === `delete-${customer.id}`}
                              onClick={() => deleteCustomer(customer.id)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}
