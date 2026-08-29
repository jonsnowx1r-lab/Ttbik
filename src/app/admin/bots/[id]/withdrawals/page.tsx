import AdminBotWithdrawals from "./AdminBotWithdrawals";

export default function AdminBotWithdrawalsPage({ params }: { params: { id: string } }) {
  return <AdminBotWithdrawals botId={params.id} />;
}
