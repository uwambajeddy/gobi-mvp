"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { BadgeCheck, Clock, FileCheck, IdCard, ShieldCheck, ShieldX } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/feedback";
import { DriverStatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { DriverProfile } from "@/types";

const licenceSchema = z.object({
  licenceNumber: z.string().min(5, "Enter your driving licence number"),
  licenceExpiresAt: z.string().min(1, "Licence expiry date is required"),
});

type LicenceValues = z.infer<typeof licenceSchema>;

const STATUS_UI = {
  approved: {
    icon: ShieldCheck,
    title: "Licence verified",
    text: "You can be assigned to shipments while your licence is unexpired.",
    tile: "bg-success-soft text-success-fg",
  },
  pending: {
    icon: Clock,
    title: "Awaiting platform review",
    text: "A platform admin will verify your licence. You cannot be assigned until then.",
    tile: "bg-warning-soft text-warning-fg",
  },
  rejected: {
    icon: ShieldX,
    title: "Licence rejected",
    text: "Check the details against your licence and resubmit below.",
    tile: "bg-danger-soft text-danger-fg",
  },
  // Approved by the platform, but the expiry date has passed.
  expired: {
    icon: ShieldX,
    title: "Licence expired",
    text: "It was verified, but the compliance gate will fail any assignment until the licence is renewed.",
    tile: "bg-danger-soft text-danger-fg",
  },
} as const;

export default function LicencePage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: async () => (await axios.get("/api/v1/driver/profile")).data.data.driverProfile as DriverProfile | null,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LicenceValues>({ resolver: zodResolver(licenceSchema) });

  const submit = useMutation({
    mutationFn: async (values: LicenceValues) => axios.post("/api/v1/driver/profile", values),
    onSuccess: () => {
      toast.success("Licence submitted for platform verification.");
      queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
    },
    onError: handleApiError,
  });

  const canSubmit = !profile || profile.status === "rejected";
  const expired = Boolean(profile?.licenceExpiresAt && new Date(profile.licenceExpiresAt) < new Date());

  return (
    <>
      <PageHeader
        title="My licence"
        description="Your licence must be verified by the platform, and unexpired, before a coordinator can assign you to a shipment."
      />

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load your licence" />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {profile ? (
            <Card>
              <CardContent className="pt-5 sm:pt-6">
                {(() => {
                  const ui = STATUS_UI[expired && profile.status === "approved" ? "expired" : profile.status];
                  const Icon = ui.icon;
                  return (
                    <div className="flex items-start gap-4">
                      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.875rem]", ui.tile)}>
                        <Icon className="h-6 w-6" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-heading text-ink">{ui.title}</p>
                          <DriverStatusBadge status={profile.status} />
                        </div>
                        <p className="mt-0.5 text-body text-ink-muted">{ui.text}</p>
                      </div>
                    </div>
                  );
                })()}

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-inset border border-line/70 px-4 py-3 sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-caption text-ink-muted">
                      <IdCard className="h-3.5 w-3.5" aria-hidden /> Licence number
                    </dt>
                    <dd className="mt-0.5 font-mono text-label font-semibold text-ink">{profile.licenceNumber}</dd>
                  </div>
                  <div className="rounded-inset border border-line/70 px-4 py-3">
                    <dt className="text-caption text-ink-muted">Expires</dt>
                    <dd className={cn("mt-0.5 text-label font-semibold", expired ? "text-danger-fg" : "text-ink")}>
                      {formatDate(profile.licenceExpiresAt)}
                      {expired && " (expired)"}
                    </dd>
                  </div>
                  <div className="rounded-inset border border-line/70 px-4 py-3">
                    <dt className="text-caption text-ink-muted">Submitted</dt>
                    <dd className="mt-0.5 text-label font-semibold text-ink">{formatDateTime(profile.createdAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-surface-muted/60">
              <CardContent className="pt-5 sm:pt-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-[0.875rem] bg-primary-50 text-primary-600">
                  <FileCheck className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-4 text-heading text-ink">No licence on file yet</p>
                <p className="mt-1 text-body text-ink-muted">Submit your licence to become assignable.</p>
                <ol className="mt-5 space-y-3">
                  {[
                    "Submit your licence number and expiry date.",
                    "A platform admin verifies the details.",
                    "Coordinators can then assign you to shipments.",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3 text-body text-ink-secondary">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-caption font-semibold text-ink shadow-card">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {canSubmit && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    <BadgeCheck className="h-[1.125rem] w-[1.125rem] text-primary-500" aria-hidden />
                    {profile ? "Resubmit your licence" : "Submit your licence"}
                  </CardTitle>
                  <CardDescription>Use the number and expiry exactly as printed on your driving licence.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit((values) => submit.mutate(values))} className="space-y-4" noValidate>
                  <Field label="Licence number" required error={errors.licenceNumber?.message}>
                    <Input placeholder="RW-DL-2026-01234" {...register("licenceNumber")} />
                  </Field>
                  <Field label="Expiry date" required error={errors.licenceExpiresAt?.message}>
                    <Input type="date" {...register("licenceExpiresAt")} />
                  </Field>
                  <Button type="submit" className="w-full" loading={submit.isPending}>
                    {submit.isPending ? "Submitting..." : "Submit for verification"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
