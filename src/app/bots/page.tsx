import { isOwnerServer } from "@/lib/isOwner";
import BotsDeployForm from "./BotsDeployForm";

export default function BotsDeployPage() {
  const isOwner = isOwnerServer();
  return <BotsDeployForm isOwner={isOwner} />;
}
