"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleApiError } from "@/lib/handleApiError";
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

export default function NewShipmentPage() {
  const axios = useAxiosAuth();
  const router = useRouter();

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

  const createShipment = useMutation({
    mutationFn: async (values: CreateShipmentValues) =>
      (await axios.post("/api/v1/shipments", values)).data.data.shipment as Shipment,
    onSuccess: (shipment) => {
      toast.success(`Shipment ${shipment.reference} created as draft.`);
      router.push(`/dashboard/shipments/${shipment.id}`);
    },
    onError: handleApiError,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-dark">New shipment</h1>
      <p className="mt-1 text-sm text-mute">
        Create the shipment record. You&apos;ll submit it for carrier quotation next.
      </p>

      <form
        onSubmit={handleSubmit((values) => createShipment.mutate(values))}
        className="mt-6 space-y-6"
        noValidate
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shipment details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Industrial machinery import: Dar to Kigali"
                {...register("title")}
              />
              {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="originAddress">Origin</Label>
                <Input
                  id="originAddress"
                  placeholder="e.g. Dar es Salaam Port, Tanzania"
                  {...register("originAddress")}
                />
                {errors.originAddress && (
                  <p className="text-sm text-red-600">{errors.originAddress.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinationAddress">Destination</Label>
                <Input
                  id="destinationAddress"
                  placeholder="e.g. Kigali Special Economic Zone"
                  {...register("destinationAddress")}
                />
                {errors.destinationAddress && (
                  <p className="text-sm text-red-600">{errors.destinationAddress.message}</p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-md border border-gray-200 p-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("isCrossBorder")}
              />
              <span>
                <span className="block text-sm font-medium">Cross-border shipment</span>
                <span className="block text-xs text-mute">
                  Adds customs and corridor documents (IDF, duty receipt, release order, COMESA
                  Yellow Card, C2 manifest) to the required checklist.
                </span>
              </span>
            </label>
            {isCrossBorder && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                Cross-border shipments require a clearing agent. You can assign one after
                submission.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Packages</CardTitle>
            <CardDescription>
              Weights feed the compliance gate (vehicle payload and the 56 t corridor limit).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g. CNC milling machine"
                    {...register(`packages.${index}.description`)}
                  />
                </div>
                <div className="w-28 space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.1" {...register(`packages.${index}.weightKg`)} />
                </div>
                <div className="w-20 space-y-2">
                  <Label>Qty</Label>
                  <Input type="number" min={1} {...register(`packages.${index}.quantity`)} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove package"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            {errors.packages && (
              <p className="text-sm text-red-600">
                {errors.packages.message || "Check the package rows for errors."}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", weightKg: 0, quantity: 1 })}
            >
              <Plus className="h-4 w-4" /> Add package
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recipient (consignee)</CardTitle>
            <CardDescription>
              The receiver signs the proof of delivery, so they don&apos;t need an account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Name</Label>
              <Input id="recipientName" placeholder="e.g. Kigali SEZ Receiving" {...register("recipientName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientPhone">Phone</Label>
              <Input id="recipientPhone" placeholder="+250788..." {...register("recipientPhone")} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={createShipment.isPending}>
          {createShipment.isPending ? "Creating..." : "Create shipment"}
        </Button>
      </form>
    </div>
  );
}
