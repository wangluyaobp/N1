import type { AnyCard, BatchTag, DeckType } from "./types";
import { supabase } from "./supabase";

const now = () => Date.now();

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function cloudUpsertTag(tag: BatchTag) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  const payload = {
    id: tag.id,
    user_id: userId,
    type: tag.type,
    name: tag.name,
    created_at: tag.createdAt,
    updated_at: now(),
    deleted: false,
  };

  const { error } = await supabase.from("tags").upsert(payload);
  if (error) throw error;
}

export async function cloudSoftDeleteTag(tagId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  const { error } = await supabase
    .from("tags")
    .update({ deleted: true, updated_at: now() })
    .eq("id", tagId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function cloudUpsertCard(card: AnyCard) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  const base: any = {
    id: card.id,
    user_id: userId,
    type: card.type,
    tag_id: card.tagId,
    front: card.front,
    srs: card.srs,
    created_at: card.createdAt,
    updated_at: now(),
    deleted: false,
  };

  if (card.type === "vocab") {
    base.reading = card.reading;
    base.pos = card.pos;
    base.meaning = card.meaning;
  } else {
    base.connect = card.connect;
    base.meaning = card.meaning;
    base.feature = (card as any).feature ?? "";
    base.example = card.example;
  }

  const { error } = await supabase.from("cards").upsert(base);
  if (error) throw error;
}

export async function cloudSoftDeleteCard(cardId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  const { error } = await supabase
    .from("cards")
    .update({ deleted: true, updated_at: now() })
    .eq("id", cardId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function cloudPullAll(type: DeckType) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in");

  const { data: tags, error: e1 } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type);

  if (e1) throw e1;

  const { data: cards, error: e2 } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type);

  if (e2) throw e2;

  return { tags: tags ?? [], cards: cards ?? [] };
}
