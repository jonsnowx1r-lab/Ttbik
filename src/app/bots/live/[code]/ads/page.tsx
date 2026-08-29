import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import AdCard from "./AdCard";

async function getAdsData(publicCode: string, uid: string) {
  const db = supabaseAdmin();
  const { data: bot } = await db.from("hosted_bots").select("id, public_code").eq("public_code", publicCode).maybeSingle();
  if (!bot) return null;

  const { data: ads } = await db
    .from("bot_ads")
    .select("id, title, reward_points, channel_username")
    .eq("bot_id", bot.id)
    .eq("is_active", true);

  const { data: viewed } = uid
    ? await db.from("bot_ad_views").select("ad_id").eq("bot_id", bot.id).eq("tg_user_id", uid)
    : { data: [] as { ad_id: string }[] };
  const viewedIds = new Set((viewed || []).map((v) => v.ad_id));

  return {
    publicCode: bot.public_code,
    ads: (ads || []).map((a) => ({ ...a, alreadyViewed: viewedIds.has(a.id) })),
  };
}

export default async function BotAdsPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { uid?: string };
}) {
  const uid = String(searchParams.uid || "");
  const data = await getAdsData(params.code, uid);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-extrabold text-slate-900">الحملات الإعلانية</h1>
      <p className="mt-2 text-sm text-slate-600">شاهد الإعلان وأكّد المشاهدة لتُضاف النقاط لرصيدك فوراً في البوت.</p>

      <div className="mt-6 space-y-4">
        {data.ads.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            لا توجد حملات نشطة حالياً. عد لاحقاً.
          </p>
        )}
        {data.ads.map((ad) => (
          <AdCard key={ad.id} publicCode={data.publicCode} uid={uid} ad={ad} />
        ))}
      </div>
    </div>
  );
}
