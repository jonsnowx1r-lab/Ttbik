import MarriagePayClient from "./MarriagePayClient";

export default function MarriagePayPage({ searchParams }: { searchParams: { uid?: string; paid?: string } }) {
  return <MarriagePayClient uid={String(searchParams.uid || "")} justPaid={searchParams.paid === "1"} />;
}
