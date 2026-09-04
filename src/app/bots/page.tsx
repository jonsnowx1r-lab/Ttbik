import type { Metadata } from "next";
import { isOwnerServer } from "@/lib/isOwner";
import AdSlot from "@/components/AdSlot";
import BotsDeployForm from "./BotsDeployForm";

export const metadata: Metadata = {
  title: "تفعيل بوت تليجرام — سوق تولز",
  description:
    "فعّل بوت تليجرام يعمل فعلياً على توكنك الخاص خلال دقائق: مشاهدة إعلانات وربح نقاط، محفظة، وإحالة. منتج جاهز تملكه وتشغّله فوراً — بدون كتابة أي شيء.",
};

export default function BotsDeployPage() {
  const isOwner = isOwnerServer();
  return (
    <BotsDeployForm
      isOwner={isOwner}
      adSlot={<AdSlot position="in-content" label="أسفل نموذج تفعيل البوت" />}
    />
  );
}
