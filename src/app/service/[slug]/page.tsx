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
import { TOOL_LABELS, ToolMode } from "@/lib/prompts";
import { getDeliveryKind } from "@/lib/deliveryKind";

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

        <div>
          <OrderForm serviceId={service.id} priceUsd={service.price_usd} />
        </div>
      </div>
    </div>
  );
}
