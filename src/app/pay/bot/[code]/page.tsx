import PayBotClient from "./PayBotClient";
import { isNowPaymentsConfigured } from "@/lib/nowpayments";

export default function PayBotPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { uid?: string; paid?: string };
}) {
  return (
    <PayBotClient
      code={params.code}
      uid={String(searchParams.uid || "")}
      cryptoAvailable={isNowPaymentsConfigured()}
      justPaid={searchParams.paid === "1"}
    />
  );
}
