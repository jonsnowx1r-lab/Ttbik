import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabase";
import type { Service } from "@/types";
import { formatUsd } from "@/lib/utils";
import OrderForm from "@/components/OrderForm";
import AiTextDemo from "@/components/demos/AiTextDemo";
import BotSimulator from "@/components/demos/BotSimulator";
import LandingBuilder from "@/components/demos/LandingBuilder";

export const revalidate = 30;

async function getService(slug: string) {
  const db = supabasePublic();
  const { data } = await db.from("services").select("*").eq("slug", slug).single();
  return data as Service | null;
}

const AI_MODE_BY_SLUG: Record<string, any> = {
  "smart-translator": { mode: "translate", placeholder: "اكتب نصاً لترجمته...", button: "ترجم الآن" },
  "text-summarizer": { mode: "summarize", placeholder: "الصق النص المراد تلخيصه...", button: "لخّص الآن" },
  "ai-chat-assistant": { mode: "assistant", placeholder: "اكتب سؤال أحد عملائك...", button: "أرسل للمساعد" },
  "social-caption-generator": { mode: "caption", placeholder: "عن ماذا تريد أن يكون المنشور؟", button: "ولّد منشوراً" },
  "blog-writer": { mode: "blog", placeholder: "اكتب الكلمة المفتاحية لمقالك...", button: "اكتب مسودة" },
  "product-description-writer": { mode: "product-desc", placeholder: "اسم المنتج ومميزاته...", button: "اكتب الوصف" },
};

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const service = await getService(params.slug);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{service.name_ar}</h1>
          <p className="mt-2 text-slate-600">{service.long_desc_ar || service.short_desc_ar}</p>
          <p className="mt-4 text-2xl font-extrabold text-brand-700">{formatUsd(service.price_usd)}</p>

          <div className="mt-6">
            {service.demo_type === "bot_simulator" && <BotSimulator botName={service.name_ar} />}
            {service.demo_type === "landing_builder" && <LandingBuilder />}
            {(service.demo_type === "ai_chat" || service.demo_type === "content_ai") &&
              AI_MODE_BY_SLUG[service.slug] && (
                <AiTextDemo
                  mode={AI_MODE_BY_SLUG[service.slug].mode}
                  placeholder={AI_MODE_BY_SLUG[service.slug].placeholder}
                  buttonLabel={AI_MODE_BY_SLUG[service.slug].button}
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
