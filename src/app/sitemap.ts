import type { MetadataRoute } from "next";
import { supabasePublic } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const db = supabasePublic();
  const { data: services } = await db.from("services").select("slug").eq("is_active", true);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/order/lookup`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/free-tools`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/free-tools/whatsapp-link`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/free-tools/business-name-generator`, changeFrequency: "monthly", priority: 0.9 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = (services ?? []).map((s) => ({
    url: `${base}/service/${s.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...serviceRoutes];
}
