import { getSupabase } from "./client";

export async function getEniaBundle() {
  const sb = getSupabase();
  const [content, advantages, fees, pieces, partners] = await Promise.all([
    sb.from("enia_content").select("*").eq("id", "singleton").maybeSingle(),
    sb.from("enia_advantages").select("*").order("ordre"),
    sb.from("enia_fee_items").select("*").order("ordre"),
    sb.from("enia_piece_groups").select("*").order("ordre"),
    sb.from("enia_partners").select("*").order("ordre"),
  ]);
  if (content.error) throw content.error;
  if (advantages.error) throw advantages.error;
  if (fees.error) throw fees.error;
  if (pieces.error) throw pieces.error;
  if (partners.error) throw partners.error;
  return {
    content: content.data,
    advantages: advantages.data || [],
    fees: fees.data || [],
    pieces: pieces.data || [],
    partners: partners.data || [],
  };
}

export async function updateEniaContent(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("enia_content").upsert({ id: "singleton", ...payload }).select("*").single();
  if (error) throw error;
  return data;
}
