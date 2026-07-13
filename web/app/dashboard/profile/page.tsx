"use client";

import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/handleApiError";
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

  const { data: user } = useQuery({
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
    mutationFn: async (values: ProfileValues) =>
      (await axios.patch("/api/v1/profile", values)).data.data.user as User,
    onSuccess: async (updated) => {
      toast.success("Profile updated.");
      queryClient.setQueryData(["profile"], updated);
      // Keep the NextAuth session (sidebar name, etc.) in sync
      await update({ user: updated });
    },
    onError: handleApiError,
  });

  const changePassword = useMutation({
    mutationFn: async (values: PasswordValues) =>
      axios.patch("/api/v1/profile/password", values),
    onSuccess: () => {
      toast.success("Password changed.");
      passwordForm.reset();
    },
    onError: handleApiError,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Profile</h1>
        <p className="mt-1 text-sm text-mute">Manage your personal information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal information</CardTitle>
          <CardDescription>{session?.user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((values) => updateProfile.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...profileForm.register("firstName")} />
                {profileForm.formState.errors.firstName && (
                  <p className="text-sm text-red-600">
                    {profileForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...profileForm.register("lastName")} />
                {profileForm.formState.errors.lastName && (
                  <p className="text-sm text-red-600">
                    {profileForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input id="phoneNumber" placeholder="+250788123456" {...profileForm.register("phoneNumber")} />
              {profileForm.formState.errors.phoneNumber && (
                <p className="text-sm text-red-600">
                  {profileForm.formState.errors.phoneNumber.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change password</CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-red-600">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" {...passwordForm.register("newPassword")} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-red-600">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" variant="outline" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
