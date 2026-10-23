"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, Mail, MapPin, Phone, RotateCw, Send, ShieldCheck, UserPlus, Users } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { capitalize, cn, formatDate, fullName } from "@/lib/utils";
import { Membership, OrgInvitation, OrgRole, UserSummary } from "@/types";

interface MemberWithUser extends Membership {
  user?: UserSummary;
}

const ROLE_VARIANT: Record<OrgRole, "default" | "info" | "secondary" | "warning"> = {
  owner: "default",
  coordinator: "info",
  member: "secondary",
  driver: "warning",
};

// Avatars share the role badge's colour, so the list scans by role.
const ROLE_AVATAR: Record<OrgRole, "brand" | "info" | "neutral" | "warning"> = {
  owner: "brand",
  coordinator: "info",
  member: "neutral",
  driver: "warning",
};

const ROLE_ORDER: OrgRole[] = ["owner", "coordinator", "member", "driver"];

export default function OrganizationPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { activeMembership, isLoading: orgLoading } = useActiveOrg();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const organizationId = activeMembership?.organizationId;
  const organization = activeMembership?.organization;
  const canManage = ["owner", "coordinator"].includes(activeMembership?.role ?? "");
  const isTransport = organization?.companyType === "transport";

  const {
    data: members,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["org-members", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () =>
      (await axios.get(`/api/v1/organizations/${organizationId}/members`)).data.data.members as MemberWithUser[],
  });

  const invitationsKey = ["org-invitations", organizationId];
  const { data: invitations = [] } = useQuery({
    queryKey: invitationsKey,
    enabled: Boolean(organizationId) && canManage,
    queryFn: async () =>
      (await axios.get(`/api/v1/organizations/${organizationId}/invitations`)).data.data.invitations as OrgInvitation[],
  });

  // Existing accounts are added at once, except drivers, who must accept; other emails get an
  // invitation (also how "Resend" works).
  const addMember = useMutation({
    mutationFn: async (target: { email: string; role: string; fromForm: boolean }) =>
      axios.post(`/api/v1/organizations/${organizationId}/members`, { email: target.email, role: target.role }),
    onSuccess: (res, target) => {
      const { invitation, resent } = res.data.data as { invitation?: OrgInvitation; resent?: boolean };
      if (invitation) {
        toast.success(`${resent ? "Invitation resent" : "Invitation sent"} to ${invitation.email}.`);
        queryClient.invalidateQueries({ queryKey: invitationsKey });
      } else {
        toast.success("Member added.");
        queryClient.invalidateQueries({ queryKey: ["org-members", organizationId] });
      }
      if (target.fromForm) setEmail("");
    },
    onError: handleApiError,
  });

  const revoke = useMutation({
    mutationFn: async (invitationId: number) =>
      axios.delete(`/api/v1/organizations/${organizationId}/invitations/${invitationId}`),
    onSuccess: () => {
      toast.success("Invitation revoked.");
      queryClient.invalidateQueries({ queryKey: invitationsKey });
    },
    onError: handleApiError,
  });

  if (orgLoading) return <PageSkeleton />;

  if (!activeMembership) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="You are not a member of any organization yet"
          description="Create one from the Overview page, or ask an owner to add you."
        />
      </Card>
    );
  }

  const list = members ?? [];
  const roleCounts = ROLE_ORDER.map((r) => ({ role: r, count: list.filter((m) => m.role === r).length })).filter(
    (r) => r.count > 0,
  );

  return (
    <>
      <PageHeader
        title={organization?.name}
        description={`${COMPANY_TYPE_LABELS[organization?.companyType ?? ""] ?? ""} organization · you are ${
          activeMembership.role === "owner" ? "the owner" : `a ${activeMembership.role}`
        }`}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* Members */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>
                  <Users className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Members
                </CardTitle>
                <CardDescription>
                  {isLoading ? "Loading..." : `${list.length} active member${list.length === 1 ? "" : "s"}`}
                </CardDescription>
              </div>
              {roleCounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {roleCounts.map(({ role: r, count }) => (
                    <Badge key={r} variant={ROLE_VARIANT[r]}>
                      {count} {r}
                      {count === 1 ? "" : "s"}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            {isError ? (
              <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load members" />
            ) : isLoading ? (
              <ListSkeleton rows={4} className="border-t border-line/60" />
            ) : list.length === 0 ? (
              <EmptyState compact icon={Users} title="No members yet" className="border-t border-line/60" />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar firstName={member.user?.firstName} lastName={member.user?.lastName} tone={ROLE_AVATAR[member.role]} />
                              <div className="min-w-0">
                                <p className="text-label font-semibold text-ink">
                                  {fullName(member.user)}
                                  {member.userId === session?.user?.id && (
                                    <span className="ml-2 text-caption font-normal text-ink-muted">(you)</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-caption text-ink-secondary">{member.user?.email}</p>
                            {member.user?.phoneNumber && (
                              <p className="text-caption text-ink-muted">{member.user.phoneNumber}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ROLE_VARIANT[member.role]}>{capitalize(member.role)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y divide-line/60 border-t border-line/60 md:hidden">
                  {list.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Avatar firstName={member.user?.firstName} lastName={member.user?.lastName} tone={ROLE_AVATAR[member.role]} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label font-semibold text-ink">
                          {fullName(member.user)}
                          {member.userId === session?.user?.id && (
                            <span className="ml-1.5 text-caption font-normal text-ink-muted">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-caption text-ink-muted">{member.user?.email}</p>
                      </div>
                      <Badge variant={ROLE_VARIANT[member.role]}>{capitalize(member.role)}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Invitations waiting for the person to create an account and accept */}
          {canManage && invitations.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>
                    <Send className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Pending invitations
                  </CardTitle>
                  <CardDescription>
                    {invitations.length} {invitations.length === 1 ? "person has" : "people have"} been invited but
                    hasn&apos;t joined yet. Links expire after 7 days.
                  </CardDescription>
                </div>
              </CardHeader>
              <ul className="divide-y divide-line/60 border-t border-line/60">
                {invitations.map((invitation) => {
                  const expired = invitation.status === "expired";
                  const resending = addMember.isPending && addMember.variables?.email === invitation.email;
                  return (
                    <li
                      key={invitation.id}
                      className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
                          <Mail className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-label font-semibold text-ink">
                            <span className="truncate">{invitation.email}</span>
                            <Badge variant={ROLE_VARIANT[invitation.role]}>{capitalize(invitation.role)}</Badge>
                          </p>
                          <p className={cn("text-caption", expired ? "text-danger-fg" : "text-ink-muted")}>
                            {invitation.invitedBy ? `Invited by ${fullName(invitation.invitedBy)} · ` : ""}
                            {expired ? "Expired" : "Expires"} {formatDate(invitation.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={resending}
                          disabled={addMember.isPending}
                          onClick={() =>
                            addMember.mutate({ email: invitation.email, role: invitation.role, fromForm: false })
                          }
                        >
                          {!resending && <RotateCw />}
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger-fg hover:bg-danger-soft hover:text-danger-fg"
                          loading={revoke.isPending && revoke.variables === invitation.id}
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate(invitation.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {canManage && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    <UserPlus className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Add member
                  </CardTitle>
                  <CardDescription>
                    People with a Gobi account join right away. Anyone else gets an email invitation to create
                    an account and join.
                    {isTransport && " Add drivers with the driver role so they can be assigned to shipments."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    addMember.mutate({ email, role, fromForm: true });
                  }}
                >
                  <Field label="Email">
                    <Input
                      type="email"
                      icon={<Mail />}
                      placeholder="member@company.rw"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                  <Field label="Role">
                    <Select value={role} onChange={(event) => setRole(event.target.value)}>
                      <option value="coordinator">Coordinator</option>
                      <option value="member">Member</option>
                      {isTransport && <option value="driver">Driver</option>}
                    </Select>
                  </Field>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!email.includes("@")}
                    loading={addMember.isPending && addMember.variables?.fromForm}
                  >
                    {addMember.isPending && addMember.variables?.fromForm ? "Adding..." : "Add member"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <Building2 className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Company details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3.5">
                {[
                  { icon: ShieldCheck, label: "Company type", value: COMPANY_TYPE_LABELS[organization?.companyType ?? ""] },
                  { icon: Mail, label: "Contact email", value: organization?.contactEmail },
                  { icon: Phone, label: "Contact phone", value: organization?.contactPhone },
                  { icon: MapPin, label: "Address", value: organization?.address },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                    <div className="min-w-0">
                      <dt className="text-caption text-ink-muted">{label}</dt>
                      <dd className="break-words text-label text-ink">
                        {value || <span className="text-ink-subtle">Not provided</span>}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
