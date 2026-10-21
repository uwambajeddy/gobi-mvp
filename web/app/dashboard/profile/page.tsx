"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Building2, KeyRound, Mail, Phone, UserRound } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/common/PageHeader";
import { handleApiError } from "@/lib/handleApiError";
import { COMPANY_TYPE_LABELS } from "@/lib/labels";
import { capitalize, formatDate } from "@/lib/utils";
import { User } from "@/types";

const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  phoneNumber: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const { memberships } = useActiveOrg();

  const { data: user, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await axios.get("/api/v1/profile")).data.data.user as User,
  });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber ?? "",
        }
      : undefined,
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const updateProfile = useMutation({
    mutationFn: async (values: ProfileValues) => (await axios.patch("/api/v1/profile", values)).data.data.user as User,
    onSuccess: async (updated) => {
      toast.success("Profile updated.");
      queryClient.setQueryData(["profile"], updated);
      // Keep the NextAuth session (sidebar name, etc.) in sync
      await update({ user: updated });
    },
    onError: handleApiError,
  });

  const changePassword = useMutation({
    mutationFn: async (values: PasswordValues) => axios.patch("/api/v1/profile/password", values),
    onSuccess: () => {
      toast.success("Password changed.");
      passwordForm.reset();
    },
    onError: handleApiError,
  });

  const person = user ?? session?.user;
  const isAdmin = person?.type === "admin";
  const profileDirty = profileForm.formState.isDirty;

  return (
    <>
      <PageHeader title="Profile" description="Manage your personal information and password." />

      <div className="grid items-start gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Identity */}
        <Card>
          <CardContent className="pt-6 text-center sm:pt-6">
            <Avatar firstName={person?.firstName} lastName={person?.lastName} size="xl" className="mx-auto" />
            {isLoading && !person ? (
              <Skeleton className="mx-auto mt-4 h-5 w-40" />
            ) : (
              <p className="mt-4 text-heading text-ink">
                {person?.firstName} {person?.lastName}
              </p>
            )}
            <p className="text-body text-ink-muted">{person?.email}</p>
            <Badge variant={isAdmin ? "default" : "secondary"} className="mt-3">
              {isAdmin ? "Platform admin" : "User account"}
            </Badge>
          </CardContent>
          <div className="space-y-3 border-t border-line/70 px-5 py-4 text-left sm:px-6">
            <div className="flex items-center gap-2.5 text-body text-ink-secondary">
              <Mail className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate">{person?.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-body text-ink-secondary">
              <Phone className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              {person?.phoneNumber || <span className="text-ink-subtle">No phone number</span>}
            </div>
            {user?.createdAt && (
              <div className="flex items-center gap-2.5 text-body text-ink-secondary">
                <UserRound className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                Member since {formatDate(user.createdAt)}
              </div>
            )}
          </div>
          {!isAdmin && memberships.length > 0 && (
            <div className="border-t border-line/70 px-5 py-4 sm:px-6">
              <p className="text-overline text-ink-muted">Organizations</p>
              <ul className="mt-2.5 space-y-2.5">
                {memberships.map((m) => (
                  <li key={m.organizationId} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-surface-sunken text-ink-secondary">
                      <Building2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-label font-semibold text-ink">{m.organization?.name}</span>
                      <span className="block text-caption text-ink-muted">
                        {COMPANY_TYPE_LABELS[m.organization?.companyType ?? ""]} · {capitalize(m.role)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <form onSubmit={profileForm.handleSubmit((values) => updateProfile.mutate(values))} noValidate>
              <CardHeader>
                <div>
                  <CardTitle>
                    <UserRound className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Personal
                    information
                  </CardTitle>
                  <CardDescription>Your email address is your sign-in and cannot be changed here.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="First name" required error={profileForm.formState.errors.firstName?.message}>
                    <Input {...profileForm.register("firstName")} />
                  </Field>
                  <Field label="Last name" required error={profileForm.formState.errors.lastName?.message}>
                    <Input {...profileForm.register("lastName")} />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Email">
                    <Input value={person?.email ?? ""} disabled readOnly />
                  </Field>
                  <Field label="Phone number" optional error={profileForm.formState.errors.phoneNumber?.message}>
                    <Input type="tel" placeholder="+250788123456" {...profileForm.register("phoneNumber")} />
                  </Field>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!profileDirty || updateProfile.isPending}
                  onClick={() => profileForm.reset()}
                >
                  Discard changes
                </Button>
                <Button type="submit" loading={updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <form onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))} noValidate>
              <CardHeader>
                <div>
                  <CardTitle>
                    <KeyRound className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden /> Change password
                  </CardTitle>
                  <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Current password" error={passwordForm.formState.errors.currentPassword?.message}>
                  <Input type="password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
                </Field>
                <Field label="New password" error={passwordForm.formState.errors.newPassword?.message}>
                  <Input type="password" autoComplete="new-password" {...passwordForm.register("newPassword")} />
                </Field>
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="outline" loading={changePassword.isPending}>
                  {changePassword.isPending ? "Updating..." : "Update password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
