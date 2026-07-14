import ShipmentWorkspace from "@/components/shipments/ShipmentWorkspace";

export default function ShipmentDetailPage({ params }: { params: { id: string } }) {
  return <ShipmentWorkspace id={params.id} />;
}
