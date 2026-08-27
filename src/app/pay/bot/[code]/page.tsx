import PayBotClient from "./PayBotClient";

export default function PayBotPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { uid?: string };
}) {
  return <PayBotClient code={params.code} uid={String(searchParams.uid || "")} />;
}
