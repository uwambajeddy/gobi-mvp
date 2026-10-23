"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Boxes, FileText, Globe, MapPin, Plus, Scale, Trash2, UserRound } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { PageHeader } from "@/components/common/PageHeader";
import { handleApiError } from "@/lib/handleApiError";
import { cn } from "@/lib/utils";
import { Shipment } from "@/types";

const packageSchema = z.object({
  description: z.string().min(2, "Describe the package"),
  weightKg: z.coerce.number().positive("Weight must be positive"),
  quantity: z.coerce.number().int().min(1, "At least 1"),
});

const createShipmentSchema = z.object({
  title: z.string().min(3, "Give the shipment a short title"),
  originAddress: z.string().min(3, "Origin is required"),
  destinationAddress: z.string().min(3, "Destination is required"),
  isCrossBorder: z.boolean().default(false),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  packages: z.array(packageSchema).min(1, "Add at least one package"),
});

type CreateShipmentValues = z.infer<typeof createShipmentSchema>;

const GVW_LIMIT_KG = 56000;

function SectionIcon({ icon: Icon }: { icon: typeof Boxes }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-[0.625rem] bg-primary-50 text-primary-600">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

export default function NewShipmentPage() {
  const axios = useAxiosAuth();
  const router = useRouter();
  const { activeMembership } = useActiveOrg();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateShipmentValues>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues: {
      isCrossBorder: false,
      packages: [{ description: "", weightKg: 0, quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "packages" });
  const isCrossBorder = watch("isCrossBorder");
  const packages = watch("packages");

  const totalKg = (packages ?? []).reduce(
    (sum, pkg) => sum + (Number(pkg.weightKg) || 0) * (Number(pkg.quantity) || 0),
    0,
  );
  const totalUnits = (packages ?? []).reduce((sum, pkg) => sum + (Number(pkg.quantity) || 0), 0);

  const createShipment = useMutation({
    mutationFn: async (values: CreateShipmentValues) =>
      (await axios.post("/api/v1/shipments", values)).data.data.shipment as Shipment,
    onSuccess: (shipment) => {
      toast.success(`Shipment ${shipment.reference} created as draft.`);
      router.push(`/dashboard/shipments/${shipment.id}`);
    },
    onError: handleApiError,
  });

  const notShipper =
    activeMembership && activeMembership.organization?.companyType !== "distribution";

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/shipments", label: "Shipments" }}
        title="New shipment"
        description="Create the shipment record as a draft. You'll submit it for carrier quotation next."
      />

      {notShipper && (
        <Callout tone="warning" title="Only distribution organizations can create shipments" className="mb-5">
          You are acting as {activeMembership?.organization?.name}. The request will be rejected unless you
          switch to a distribution organization.
        </Callout>
      )}

      <form
        onSubmit={handleSubmit((values) => createShipment.mutate(values))}
        noValidate
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-5">
          {/* Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon icon={FileText} />
                <div>
                  <CardTitle>Shipment details</CardTitle>
                  <CardDescription>What is moving, and between which places.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title" required error={errors.title?.message}>
                <Input placeholder="e.g. Industrial machinery import: Dar to Kigali" {...register("title")} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Origin" required error={errors.originAddress?.message}>
                  <Input
                    icon={<MapPin />}
                    placeholder="e.g. Dar es Salaam Port, Tanzania"
                    {...register("originAddress")}
                  />
                </Field>
                <Field label="Destination" required error={errors.destinationAddress?.message}>
                  <Input
                    icon={<MapPin />}
                    placeholder="e.g. Kigali Special Economic Zone"
                    {...register("destinationAddress")}
                  />
                </Field>
              </div>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-inset border p-4 transition-colors",
                  isCrossBorder ? "border-info-line bg-info-soft/60" : "border-line hover:bg-surface-muted",
                )}
              >
                <input type="checkbox" className="checkbox mt-0.5" {...register("isCrossBorder")} />
                <span>
                  <span className="flex items-center gap-1.5 text-label font-semibold text-ink">
                    <Globe className="h-4 w-4 text-info-fg" aria-hidden /> Cross-border shipment
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-muted">
                    Adds customs and corridor documents (IDF, duty receipt, release order, COMESA Yellow
                    Card, C2 manifest) to the required checklist.
                  </span>
                </span>
              </label>
              {isCrossBorder && (
                <Callout tone="warning">
                  Cross-border shipments require a clearing agent. You can assign one after submission.
                </Callout>
              )}
            </CardContent>
          </Card>

          {/* Packages */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon icon={Boxes} />
                <div>
                  <CardTitle>Packages</CardTitle>
                  <CardDescription>
                    Weights feed the compliance gate (vehicle payload and the 56 t corridor limit).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((field, index) => {
                const rowErrors = errors.packages?.[index];
                return (
                  <fieldset
                    key={field.id}
                    className="rounded-inset border border-line/70 bg-surface-muted/50 p-3.5"
                  >
                    <legend className="sr-only">Package {index + 1}</legend>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_8rem_6rem_auto] md:items-start">
                      <Field
                        label={`Package ${index + 1}`}
                        error={rowErrors?.description?.message}
                        className="col-span-2 md:col-span-1"
                      >
                        <Input
                          placeholder="e.g. CNC milling machine"
                          {...register(`packages.${index}.description`)}
                        />
                      </Field>
                      <Field label="Weight (kg)" error={rowErrors?.weightKg?.message}>
                        <Input type="number" step="0.1" min={0} {...register(`packages.${index}.weightKg`)} />
                      </Field>
                      <Field label="Qty" error={rowErrors?.quantity?.message}>
                        <Input type="number" min={1} {...register(`packages.${index}.quantity`)} />
                      </Field>
                      <div className="col-span-2 flex justify-end md:col-span-1 md:pt-[1.625rem]">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove package ${index + 1}`}
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                          className="text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              {errors.packages?.message && <FieldError>{errors.packages.message}</FieldError>}
              {errors.packages?.root?.message && <FieldError>{errors.packages.root.message}</FieldError>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: "", weightKg: 0, quantity: 1 })}
              >
                <Plus /> Add package
              </Button>
            </CardContent>
          </Card>

          {/* Recipient */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon icon={UserRound} />
                <div>
                  <CardTitle>Recipient (consignee)</CardTitle>
                  <CardDescription>
                    The receiver signs the proof of delivery, so they don&apos;t need an account.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Name" optional>
                <Input placeholder="e.g. Kigali SEZ Receiving" {...register("recipientName")} />
              </Field>
              <Field label="Phone" optional>
                <Input type="tel" placeholder="+250788..." {...register("recipientPhone")} />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-body text-ink-muted">
                    <Boxes className="h-4 w-4" aria-hidden /> Package lines
                  </dt>
                  <dd className="text-label tabular-nums text-ink">{fields.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-body text-ink-muted">
                    <Boxes className="h-4 w-4" aria-hidden /> Units
                  </dt>
                  <dd className="text-label tabular-nums text-ink">{totalUnits.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-body text-ink-muted">
                    <Scale className="h-4 w-4" aria-hidden /> Cargo weight
                  </dt>
                  <dd className="text-label tabular-nums text-ink">{totalKg.toLocaleString()} kg</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-body text-ink-muted">
                    <Globe className="h-4 w-4" aria-hidden /> Route type
                  </dt>
                  <dd className="text-label text-ink">{isCrossBorder ? "Cross-border" : "Domestic"}</dd>
                </div>
              </dl>
              {totalKg > GVW_LIMIT_KG && (
                <Callout tone="danger">
                  Cargo exceeds the 56,000 kg corridor limit, so the compliance gate will fail at
                  dispatch unless a coordinator overrides it.
                </Callout>
              )}
              <div className="rounded-inset bg-surface-muted p-3.5">
                <p className="text-overline text-ink-muted">What happens next</p>
                <ol className="mt-2 space-y-1.5 text-caption text-ink-secondary">
                  <li>1. Saved as a draft you can review.</li>
                  <li>2. Submit it and assign a carrier.</li>
                  <li>3. The carrier quotes; you approve.</li>
                  <li>4. The document checklist opens.</li>
                </ol>
              </div>
              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" loading={createShipment.isPending}>
                  {createShipment.isPending ? "Creating..." : "Create shipment"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" asChild>
                  <Link href="/dashboard/shipments">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>
    </>
  );
}
