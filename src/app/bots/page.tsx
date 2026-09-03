import type { Metadata } from "next";
import { isOwnerServer } from "@/lib/isOwner";
import AdSlot from "@/components/AdSlot";
import BotsDeployForm from "./BotsDeployForm";

export const metadata: Metadata = {
  title: "تفعيل بوت تليجرام إعلاني — سوق تولز",
  description: "فعّل بوت تليجرام إعلاني يعمل فعلياً بتوكنك الخاص خلال دقائق — مشاهدة وربح، محفظة نقاط، ونظام إحالة، دون أي كود تحتاج كتابته.",
};

export default function BotsDeployPage() {
  const isOwner = isOwnerServer();
  return (
    <BotsDeployForm isOwner={isOwner} adSlot={<AdSlot position="in-content" label="أسفل نموذج تفعيل البوت" />} />
  );
}
