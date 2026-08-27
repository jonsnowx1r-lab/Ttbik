import PayBotClient from "./PayBotClient";

export default function PayBotPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { kind?: string; uid?: string };
}) {
  const kind = searchParams.kind === "withdraw" ? "withdraw" : "deposit";
  return <PayBotClient code={params.code} kind={kind} uid={String(searchParams.uid || "")} />;
}
