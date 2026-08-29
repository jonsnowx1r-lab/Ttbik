import AdminBotCampaigns from "./AdminBotCampaigns";

export default function AdminBotCampaignsPage({ params }: { params: { id: string } }) {
  return <AdminBotCampaigns botId={params.id} />;
}
