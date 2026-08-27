import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import type { Service } from "@/types";
import { formatUsd } from "@/lib/utils";
import OrderForm from "@/components/OrderForm";
import AiTextDemo from "@/components/demos/AiTextDemo";
import BotSimulator from "@/components/demos/BotSimulator";
import LandingBuilder from "@/components/demos/LandingBuilder";
import CatalogBuilder from "@/components/demos/CatalogBuilder";
import AdSlotPreview from "@/components/demos/AdSlotPreview";
import { TOOL_LABELS, ToolMode } from "@/lib/prompts";
import { getDeliveryKind } from "@/lib/deliveryKind";
import { isOwnerServer } from "@/lib/isOwner";
import Link from "next/link";

export const revalidate = 30;

async function getService(slug: string) {
  const db = supabasePublic();
  const { data } = await db.from("services").select("*").eq("slug", slug).single();
  return data as Service | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = await getService(params.slug);
  if (!service) return {};
  const description = service.short_desc_ar || service.long_desc_ar || undefined;
  return {
    title: `${service.name_ar} — ${formatUsd(service.price_usd)} | سوق تولز`,
    description,
    openGraph: { title: service.name_ar, description, type: "website" },
  };
}

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const service = await getService(params.slug);
  if (!service) notFound();

  const isOwner = isOwnerServer();
  const ownerLink = service.tool_route ? `/tools/${service.tool_route}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {getDeliveryKind(service).label}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">{service.name_ar}</h1>
          <p className="mt-2 text-slate-600">{service.long_desc_ar || service.short_desc_ar}</p>
          <p className="mt-1 text-xs text-slate-400">{getDeliveryKind(service).detail}</p>
          <p className="mt-4 text-2xl font-extrabold text-brand-700">{formatUsd(service.price_usd)}</p>

          <div className="mt-6">
            {service.demo_type === "bot_simulator" && <BotSimulator botName={service.name_ar} />}
            {service.demo_type === "landing_builder" && <LandingBuilder />}
            {service.demo_type === "catalog_builder" && <CatalogBuilder />}
            {service.demo_type === "ad_slot_preview" && (
              <AdSlotPreview channelName={service.slug === "channel-ad-slot" ? "@ttbik5" : "@your_channel"} />
            )}
            {service.demo_type === "studio_tool" && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                🎬 أداة حقيقية تعمل بالكامل داخل متصفحك — لا رفع لملفاتك لأي خادم. بعد الموافقة على طلبك، تحصل على
                رابط دائم للنسخة الكاملة بلا حدود استخدام.
              </div>
            )}
            {(service.demo_type === "ai_chat" || service.demo_type === "content_ai") &&
              service.tool_route &&
              TOOL_LABELS[service.tool_route as ToolMode] && (
                <AiTextDemo
                  mode={service.tool_route as ToolMode}
                  placeholder={TOOL_LABELS[service.tool_route as ToolMode].placeholder}
                  buttonLabel={TOOL_LABELS[service.tool_route as ToolMode].button}
                />
              )}
          </div>
        </div>

        <div className="space-y-4">
          {isOwner && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="mb-2 text-xs font-bold text-emerald-700">🔑 وضع المالك — وصول مباشر بلا طلب</p>
              {ownerLink ? (
                <Link
                  href={ownerLink}
                  className="block w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700"
                >
                  افتح الأداة الكاملة الآن
                </Link>
              ) : service.delivery_type === "link" && service.delivery_content ? (
                <a
                  href={service.delivery_content}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full break-all rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700"
                >
                  فتح رابط التسليم
                </a>
              ) : service.delivery_content ? (
                <p className="text-sm text-emerald-900">{service.delivery_content}</p>
              ) : (
                <p className="text-sm text-emerald-900">لا يوجد رابط تسليم ثابت لهذه الخدمة بعد.</p>
              )}
            </div>
          )}
          <OrderForm serviceId={service.id} priceUsd={service.price_usd} />
        </div>
      </div>
    </div>
  );
}
