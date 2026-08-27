import AdminBotAds from "./AdminBotAds";

export default function AdminBotAdsPage({ params }: { params: { id: string } }) {
  return <AdminBotAds botId={params.id} />;
}
