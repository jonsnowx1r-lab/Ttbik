import WatchClient from "./WatchClient";

export default function WatchPage({ params }: { params: { token: string } }) {
  return <WatchClient token={params.token} />;
}
