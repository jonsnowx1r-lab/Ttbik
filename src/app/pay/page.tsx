import PayClient from "./PayClient";

export default function PayPage({ searchParams }: { searchParams: { uid?: string; paid?: string } }) {
  return <PayClient uid={String(searchParams.uid || "")} justPaid={searchParams.paid === "1"} />;
}
