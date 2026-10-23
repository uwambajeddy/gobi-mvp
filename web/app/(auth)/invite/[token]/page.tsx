"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarClock, CheckCircle2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import axios from "@/lib/axios";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { rememberActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { Callout, Skeleton } from "@/components/ui/feedback";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { formatDate, fullName } from "@/lib/utils";
import { OrgInvitation, OrgRole } from "@/types";

const ROLE_PHRASE: Record<OrgRole, string> = {
  owner: "an owner",
  coordinator: "a coordinator",
  member: "a member",
  driver: "a driver",
};

const sameEmail = (a?: string | null, b?: string | null) =>
  Boolean(a && b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/**
 * Where an emailed invitation link lands. Someone without an account creates
 * one here (email prefilled), then accepts; someone signed in accepts directly.
 */
export default function InvitationPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const axiosAuth = useAxiosAuth();
  const { data: session, status: sessionStatus } = useSession();
  const invitePath = `/invite/${token}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invitation", token],
    retry: false,
    queryFn: async () =>
      (await axios.get(`/api/v1/invitations/${token}`)).data.data as { invitation: OrgInvitation; hasAccount: boolean },
  });

  const accept = useMutation({
    mutationFn: async () => axiosAuth.post(`/api/v1/invitations/${token}/accept`),
    onSuccess: () => {
      const invitation = data!.invitation;
      rememberActiveOrg(invitation.organizationId);
      queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
      toast.success(`You joined ${invitation.organization?.name}.`);
      router.push("/dashboard");
    },
    onError: handleApiError,
  });

  const invitation = data?.invitation;
  const org = invitation?.organization;
  const inviter = fullName(invitation?.invitedBy) || "Someone";
  const message =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ??
    "Check the link in your email and try again.";

  return (
    <div className="glass rounded-[1.75rem] p-6 sm:p-9">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-6 h-control-lg w-full" />
        </div>
      ) : isError || !invitation ? (
        <>
          <h1 className="font-display text-[1.875rem] font-bold leading-tight text-ink">Invitation not found</h1>
          <Callout tone="danger" className="mt-5">
            {message}
          </Callout>
          <Button asChild variant="outline" size="lg" className="mt-6 w-full">
            <Link href="/">Go to Gobi</Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-[1.875rem] font-bold leading-tight text-ink">Join {org?.name}</h1>
          <p className="mt-2 text-body text-ink-muted">
            {inviter} invited <span className="font-medium text-ink-secondary">{invitation.email}</span> to join{" "}
            {org?.name} on Gobi as {ROLE_PHRASE[invitation.role]}.
          </p>

          <dl className="mt-6 grid gap-2.5">
            {[
              { icon: ShieldCheck, label: "Company", value: `${org?.name} · ${COMPANY_TYPE_LABELS[org?.companyType ?? ""] ?? ""}` },
              { icon: UserPlus, label: "Role", value: invitation.role },
              {
                icon: CalendarClock,
                label: invitation.status === "expired" ? "Expired" : "Expires",
                value: formatDate(invitation.expiresAt),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="tile flex items-center gap-3 rounded-inset px-3.5 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-primary-500" aria-hidden />
                <dt className="w-20 shrink-0 text-caption text-ink-muted">{label}</dt>
                <dd className="min-w-0 truncate text-label font-semibold capitalize text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7">
            {invitation.status === "accepted" ? (
              <>
                <Callout tone="success">This invitation has already been accepted.</Callout>
                <Button asChild size="lg" className="mt-4 w-full">
                  <Link href={sessionStatus === "authenticated" ? "/dashboard" : "/signin"}>
                    {sessionStatus === "authenticated" ? "Open Gobi" : "Sign in"}
                  </Link>
                </Button>
              </>
            ) : invitation.status !== "pending" ? (
              <Callout tone="warning">
                This invitation {invitation.status === "expired" ? "has expired" : "was withdrawn"}. Ask {inviter} at{" "}
                {org?.name} to send you a new one.
              </Callout>
            ) : sessionStatus === "loading" ? (
              <Skeleton className="h-control-lg w-full" />
            ) : sessionStatus === "authenticated" ? (
              sameEmail(session?.user?.email, invitation.email) ? (
                <Button size="lg" className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
                  {!accept.isPending && <CheckCircle2 />}
                  {accept.isPending ? "Joining..." : "Accept invitation"}
                </Button>
              ) : (
                <>
                  <Callout tone="warning">
                    You&apos;re signed in as {session?.user?.email}. This invitation is for {invitation.email}.
                  </Callout>
                  <Button
                    variant="outline"
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => signOut({ callbackUrl: invitePath })}
                  >
                    Sign out and switch account
                  </Button>
                </>
              )
            ) : data.hasAccount ? (
              <Button asChild size="lg" className="w-full">
                <Link href={`/signin?callbackUrl=${encodeURIComponent(invitePath)}`}>
                  <LogIn /> Sign in to accept
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href={`/signup?invite=${encodeURIComponent(token)}`}>
                    <UserPlus /> Create your account
                  </Link>
                </Button>
                <p className="mt-4 text-center text-body text-ink-muted">
                  You&apos;ll accept the invitation right after.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
