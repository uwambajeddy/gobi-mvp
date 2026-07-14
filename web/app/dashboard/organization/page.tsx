"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, UserPlus } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { Membership, UserSummary } from "@/types";

interface MemberWithUser extends Membership {
  user?: UserSummary;
}

export default function OrganizationPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const { activeMembership, isLoading: orgLoading } = useActiveOrg();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const organizationId = activeMembership?.organizationId;
  const canManage = ["owner", "coordinator"].includes(activeMembership?.role ?? "");
  const isTransport = activeMembership?.organization?.companyType === "transport";

  const { data: members, isLoading } = useQuery({
    queryKey: ["org-members", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () =>
      (await axios.get(`/api/v1/organizations/${organizationId}/members`)).data.data
        .members as MemberWithUser[],
  });

  const addMember = useMutation({
    mutationFn: async () =>
      axios.post(`/api/v1/organizations/${organizationId}/members`, { email, role }),
    onSuccess: () => {
      toast.success("Member added.");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["org-members", organizationId] });
    },
    onError: handleApiError,
  });

  if (orgLoading) {
    return <p className="py-16 text-center text-sm text-mute">Loading organization...</p>;
  }
  if (!activeMembership) {
    return (
      <p className="py-16 text-center text-sm text-mute">
        You are not a member of any organization yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary">
          <Building2 className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-dark">{activeMembership.organization?.name}</h1>
          <p className="text-sm text-mute">
            {COMPANY_TYPE_LABELS[activeMembership.organization?.companyType ?? ""]} organization ·
            you are {activeMembership.role === "owner" ? "the owner" : `a ${activeMembership.role}`}
          </p>
        </div>
      </div>

      {canManage && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-4 w-4 text-primary" /> Add member
            </CardTitle>
            <CardDescription>
              The person must already have a Gobi account (registered with this email).
              {isTransport && " Add drivers with the driver role so they can be assigned to shipments."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="member@company.rw"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="w-44 space-y-2">
              <Label>Role</Label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="coordinator">Coordinator</option>
                <option value="member">Member</option>
                {isTransport && <option value="driver">Driver</option>}
              </select>
            </div>
            <Button
              disabled={!email.includes("@") || addMember.isPending}
              onClick={() => addMember.mutate()}
            >
              {addMember.isPending ? "Adding..." : "Add"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-mute">Loading members...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user?.firstName} {member.user?.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-mute">{member.user?.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {member.role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
