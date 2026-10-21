"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState } from "@/components/common/States";
import { handleApiError } from "@/lib/handleApiError";
import { cn, formatDate } from "@/lib/utils";
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

const SOON_DAYS = 30;
const isExpired = (date?: string | null) => Boolean(date && new Date(date) < new Date());

type DocState = "valid" | "soon" | "expired" | "missing";

const docState = (date?: string | null): DocState => {
  if (!date) return "missing";
  if (isExpired(date)) return "expired";
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  return days <= SOON_DAYS ? "soon" : "valid";
};

const DOC_STATE_UI: Record<DocState, { label: string; icon: typeof CheckCircle2; className: string }> = {
  valid: { label: "Valid", icon: CheckCircle2, className: "text-success-fg" },
  soon: { label: `Expires within ${SOON_DAYS} days`, icon: CalendarClock, className: "text-warning-fg" },
  expired: { label: "Expired", icon: XCircle, className: "text-danger-fg" },
  missing: { label: "Not on file", icon: CircleDashed, className: "text-ink-muted" },
};

const COMPLIANCE_DOCS: { key: keyof Vehicle; label: string }[] = [
  { key: "insuranceExpiresAt", label: "Insurance" },
  { key: "inspectionExpiresAt", label: "Inspection" },
  { key: "yellowCardExpiresAt", label: "COMESA Yellow Card" },
];

const vehicleHealth = (vehicle: Vehicle) => {
  const states = COMPLIANCE_DOCS.map(({ key }) => docState(vehicle[key] as string | null));
  if (states.includes("expired")) return "expired" as const;
  if (states.includes("missing")) return "incomplete" as const;
  return "valid" as const;
};

function VehicleCard({
  vehicle,
  canManage,
  onEdit,
  onDelete,
}: {
  vehicle: Vehicle;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const health = vehicleHealth(vehicle);
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary-50 text-primary-600">
            <Truck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="whitespace-nowrap font-mono text-label font-semibold text-ink">{vehicle.plateNumber}</p>
            <p className="truncate text-caption text-ink-muted">{vehicle.model}</p>
          </div>
        </div>
        {health === "valid" ? (
          <Badge className="shrink-0" variant="success" dot>
            Compliant
          </Badge>
        ) : health === "expired" ? (
          <Badge className="shrink-0" variant="destructive" dot>
            Expired
          </Badge>
        ) : (
          <Badge className="shrink-0" variant="warning" dot>
            Incomplete
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 px-5">
        <div className="tile rounded-inset px-3 py-2.5">
          <dt className="text-caption text-ink-muted">Type</dt>
          <dd className="text-label font-semibold text-ink">{TYPE_LABELS[vehicle.type]}</dd>
        </div>
        <div className="tile rounded-inset px-3 py-2.5">
          <dt className="text-caption text-ink-muted">Capacity</dt>
          <dd className="text-label font-semibold tabular-nums text-ink">
            {vehicle.capacityKg?.toLocaleString() ?? "-"} kg
          </dd>
        </div>
      </dl>

      <ul className="mt-4 flex-1 divide-y divide-line/60 border-t border-line/60">
        {COMPLIANCE_DOCS.map(({ key, label }) => {
          const date = vehicle[key] as string | null | undefined;
          const state = docState(date);
          const { label: stateLabel, icon: Icon, className } = DOC_STATE_UI[state];
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="text-label text-ink-secondary">{label}</span>
              <span className={cn("flex items-center gap-1.5 text-caption font-medium", className)}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {state === "missing" ? stateLabel : formatDate(date)}
                <span className="sr-only">({stateLabel})</span>
              </span>
            </li>
          );
        })}
      </ul>

      {canManage && (
        <div className="flex justify-end gap-1 border-t border-line/60 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${vehicle.plateNumber}`}>
            <Pencil /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete ${vehicle.plateNumber}`}
            className="text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
          >
            <Trash2 /> Delete
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function FleetPage() {
  const axios = useAxiosAuth();
  const queryClient = useQueryClient();
  const { activeMembership } = useActiveOrg();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const canManage = ["owner", "coordinator"].includes(activeMembership?.role ?? "");

  const {
    data: fleet,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
    },
    onError: handleApiError,
  });

  const list = fleet ?? [];
  const health = list.map(vehicleHealth);
  const totalCapacity = list.reduce((sum, v) => sum + (v.capacityKg ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Fleet"
        description="Vehicle compliance dates feed the assignment gate. Expired insurance or inspection fails it, as does an expired Yellow Card on cross-border shipments."
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus /> Register vehicle
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Vehicles"
          value={list.length}
          detail={`${totalCapacity.toLocaleString()} kg total capacity`}
          icon={Truck}
          tone="brand"
          loading={isLoading}
        />
        <StatCard
          label="Compliant"
          value={health.filter((h) => h === "valid").length}
          detail="All dates on file and valid"
          icon={ShieldCheck}
          tone="success"
          loading={isLoading}
        />
        <StatCard
          label="Expired document"
          value={health.filter((h) => h === "expired").length}
          detail="Can fail the compliance gate"
          icon={ShieldAlert}
          tone="danger"
          loading={isLoading}
        />
        <StatCard
          label="Incomplete"
          value={health.filter((h) => h === "incomplete").length}
          detail="At least one date not on file"
          icon={AlertTriangle}
          tone="warning"
          loading={isLoading}
        />
      </div>

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} title="We couldn't load the fleet" />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Truck}
            title="No vehicles registered yet"
            description="Register vehicles with their capacity and compliance dates so coordinators can dispatch them."
            action={
              canManage && (
                <Button size="sm" onClick={openCreate}>
                  <Plus /> Register vehicle
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              canManage={canManage}
              onEdit={() => openEdit(vehicle)}
              onDelete={() => setDeleting(vehicle)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        dismissible={!save.isPending}
        size="lg"
        title={editing ? `Edit ${editing.plateNumber}` : "Register a vehicle"}
        description="Expired insurance or inspection blocks dispatch; an expired COMESA Yellow Card blocks cross-border dispatch."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="vehicle-form" loading={save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save changes" : "Register vehicle"}
            </Button>
          </>
        }
      >
        <form
          id="vehicle-form"
          onSubmit={handleSubmit((values) => save.mutate(values))}
          className="space-y-4 pb-2"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plate number" required error={errors.plateNumber?.message}>
              <Input placeholder="RAE 001 T" {...register("plateNumber")} />
            </Field>
            <Field label="Model" required error={errors.model?.message}>
              <Input placeholder="Mercedes Actros 2545" {...register("model")} />
            </Field>
            <Field label="Type">
              <Select {...register("type")}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Capacity (kg)" required error={errors.capacityKg?.message}>
              <Input type="number" min={1} {...register("capacityKg")} />
            </Field>
          </div>
          <fieldset className="rounded-inset border border-line/70 p-4">
            <legend className="px-1 text-label text-ink-secondary">Compliance expiry dates</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Insurance" optional>
                <Input type="date" {...register("insuranceExpiresAt")} />
              </Field>
              <Field label="Inspection" optional>
                <Input type="date" {...register("inspectionExpiresAt")} />
              </Field>
              <Field label="Yellow Card" optional>
                <Input type="date" {...register("yellowCardExpiresAt")} />
              </Field>
            </div>
          </fieldset>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title={`Delete ${deleting?.plateNumber ?? "vehicle"}?`}
        description="The vehicle is removed from your fleet. A vehicle on an active shipment can't be deleted; finished shipments keep their history but lose the vehicle link."
        confirmLabel="Delete vehicle"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
