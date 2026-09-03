import JobsPayClient from "./JobsPayClient";

export default function JobsPayPage({ searchParams }: { searchParams: { uid?: string; paid?: string } }) {
  return <JobsPayClient uid={String(searchParams.uid || "")} justPaid={searchParams.paid === "1"} />;
}
