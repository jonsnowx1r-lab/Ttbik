import AdminBotFacilities from "./AdminBotFacilities";

export default function AdminBotFacilitiesPage({ params }: { params: { id: string } }) {
  return <AdminBotFacilities botId={params.id} />;
}
