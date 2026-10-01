"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/handleApiError";
import { Vehicle } from "@/types";

const vehicleSchema = z.object({
  plateNumber: z.string().min(3, "Plate number is required"),
  model: z.string().min(2, "Model is required"),
  type: z.enum(["truck", "van", "trailer", "pickup"]),
  capacityKg: z.coerce.number().positive("Capacity must be positive"),
  insuranceExpiresAt: z.string().optional(),
  inspectionExpiresAt: z.string().optional(),
  yellowCardExpiresAt: z.string().optional(),
});

type VehicleValues = z.infer<typeof vehicleSchema>;

const TYPE_LABELS: Record<Vehicle["type"], string> = {
  truck: "Truck",
  van: "Van",
  trailer: "Trailer",
  pickup: "Pickup",
};

const isExpired = (date?: string | null) => date && new Date(date) < new Date();

function ComplianceChip({ label, date }: { label: string; date?: string | null }) {
  if (!date) return <Badge variant="secondary">{label}: not on file</Badge>;
  return (
    <Badge variant={isExpired(date) ? "destructive" : "success"}>
      {label}: {isExpired(date) ? "expired" : "valid"} {date}
    </Badge>
  );
}

export default function FleetPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const { activeMembership } = useActiveOrg();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canManage = ["owner", "coordinator"].includes(activeMembership?.role ?? "");

  const { data: fleet, isLoading } = useQuery({
    queryKey: ["fleet"],
    queryFn: async () => (await axios.get("/api/v1/vehicles")).data.data.vehicles as Vehicle[],
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleValues>({ resolver: zodResolver(vehicleSchema) });

  const openCreate = () => {
    setEditing(null);
    reset({ plateNumber: "", model: "", type: "truck", capacityKg: undefined });
    setFormOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle);
    reset({
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      type: vehicle.type,
      capacityKg: vehicle.capacityKg ?? undefined,
      insuranceExpiresAt: vehicle.insuranceExpiresAt ?? "",
      inspectionExpiresAt: vehicle.inspectionExpiresAt ?? "",
      yellowCardExpiresAt: vehicle.yellowCardExpiresAt ?? "",
    });
    setFormOpen(true);
  };

  const cleanDates = (values: VehicleValues) => ({
    ...values,
    insuranceExpiresAt: values.insuranceExpiresAt || null,
    inspectionExpiresAt: values.inspectionExpiresAt || null,
    yellowCardExpiresAt: values.yellowCardExpiresAt || null,
  });

  const save = useMutation({
    mutationFn: async (values: VehicleValues) =>
      editing
        ? axios.patch(`/api/v1/vehicles/${editing.id}`, cleanDates(values))
        : axios.post("/api/v1/vehicles", cleanDates(values)),
    onSuccess: () => {
      toast.success(editing ? "Vehicle updated." : "Vehicle registered.");
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: handleApiError,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => axios.delete(`/api/v1/vehicles/${id}`),
    onSuccess: () => {
      toast.success("Vehicle deleted.");
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
    },
    onError: handleApiError,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Fleet</h1>
          <p className="mt-1 text-sm text-mute">
            Vehicle compliance dates feed the assignment gate.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Register vehicle
          </Button>
        )}
      </div>

      {formOpen && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{editing ? "Edit vehicle" : "Register a vehicle"}</CardTitle>
            <CardDescription>
              Expired insurance, inspection or COMESA Yellow Card will block dispatch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Plate number</Label>
                  <Input placeholder="RAE 001 T" {...register("plateNumber")} />
                  {errors.plateNumber && (
                    <p className="text-sm text-red-600">{errors.plateNumber.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input placeholder="Mercedes Actros 2545" {...register("model")} />
                  {errors.model && <p className="text-sm text-red-600">{errors.model.message}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    {...register("type")}
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity (kg)</Label>
                  <Input type="number" min={1} {...register("capacityKg")} />
                  {errors.capacityKg && (
                    <p className="text-sm text-red-600">{errors.capacityKg.message}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Insurance expires</Label>
                  <Input type="date" {...register("insuranceExpiresAt")} />
                </div>
                <div className="space-y-2">
                  <Label>Inspection expires</Label>
                  <Input type="date" {...register("inspectionExpiresAt")} />
                </div>
                <div className="space-y-2">
                  <Label>Yellow Card expires</Label>
                  <Input type="date" {...register("yellowCardExpiresAt")} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving..." : editing ? "Save changes" : "Register vehicle"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-mute">Loading fleet...</p>
        ) : (fleet ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 py-12 text-center text-sm text-mute">
            No vehicles registered yet.
          </p>
        ) : (
          fleet!.map((vehicle) => (
            <Card key={vehicle.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary">
                      <Truck className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">
                        {vehicle.plateNumber}{" "}
                        <span className="font-normal text-mute">· {vehicle.model}</span>
                      </p>
                      <p className="text-xs text-mute">
                        {TYPE_LABELS[vehicle.type]} · {vehicle.capacityKg?.toLocaleString()} kg capacity
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(vehicle)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm(`Delete ${vehicle.plateNumber}?`)) remove.mutate(vehicle.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ComplianceChip label="Insurance" date={vehicle.insuranceExpiresAt} />
                  <ComplianceChip label="Inspection" date={vehicle.inspectionExpiresAt} />
                  <ComplianceChip label="Yellow Card" date={vehicle.yellowCardExpiresAt} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
