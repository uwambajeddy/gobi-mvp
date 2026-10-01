"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/handleApiError";
import { formatDateTime } from "@/lib/utils";
import { DriverProfile } from "@/types";

const licenceSchema = z.object({
  licenceNumber: z.string().min(5, "Enter your driving licence number"),
  licenceExpiresAt: z.string().min(1, "Licence expiry date is required"),
});

type LicenceValues = z.infer<typeof licenceSchema>;

export default function LicencePage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: async () =>
      (await axios.get("/api/v1/driver/profile")).data.data.driverProfile as DriverProfile | null,
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

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-dark">My licence</h1>
      <p className="mt-1 text-sm text-mute">
        Your licence must be verified by the platform, and unexpired, before a coordinator can
        assign you to a shipment.
      </p>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-mute">Loading...</p>
      ) : (
        <>
          {profile && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Verification status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-mute">Status</dt>
                    <dd>
                      <Badge
                        variant={
                          profile.status === "approved"
                            ? "success"
                            : profile.status === "rejected"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-mute">Licence number</dt>
                    <dd className="font-mono font-medium">{profile.licenceNumber}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-mute">Expires</dt>
                    <dd className="font-medium">{profile.licenceExpiresAt ?? "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-mute">Submitted</dt>
                    <dd className="font-medium">{formatDateTime(profile.createdAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          {canSubmit && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  {profile ? "Resubmit your licence" : "Submit your licence"}
                </CardTitle>
                <CardDescription>
                  Use the number and expiry exactly as printed on your driving licence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit((values) => submit.mutate(values))}
                  className="space-y-4"
                  noValidate
                >
                  <div className="space-y-2">
                    <Label htmlFor="licenceNumber">Licence number</Label>
                    <Input id="licenceNumber" placeholder="RW-DL-2026-01234" {...register("licenceNumber")} />
                    {errors.licenceNumber && (
                      <p className="text-sm text-red-600">{errors.licenceNumber.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenceExpiresAt">Expiry date</Label>
                    <Input id="licenceExpiresAt" type="date" {...register("licenceExpiresAt")} />
                    {errors.licenceExpiresAt && (
                      <p className="text-sm text-red-600">{errors.licenceExpiresAt.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={submit.isPending}>
                    {submit.isPending ? "Submitting..." : "Submit for verification"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
