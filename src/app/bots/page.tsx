import { isOwnerServer } from "@/lib/isOwner";
import AdSlot from "@/components/AdSlot";
import BotsDeployForm from "./BotsDeployForm";

export default function BotsDeployPage() {
  const isOwner = isOwnerServer();
  return (
    <BotsDeployForm isOwner={isOwner} adSlot={<AdSlot position="in-content" label="أسفل نموذج تفعيل البوت" />} />
  );
}
