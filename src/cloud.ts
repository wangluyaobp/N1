import type { AnyCard, BatchTag, DeckType } from "./types";
import { supabase } from "./supabase";

const now = () => Date.now();

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data.user?.id ?? null;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function tagPayload(userId: string, tag: BatchTag) {
  return {
    id: tag.id,
    user_id: userId,
    type: tag.type,
    name: tag.name,
    created_at: tag.createdAt,
    updated_at: now(),
    deleted: false,
  };
}

function cardPayload(userId: string, card: AnyCard) {
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
    base.reading = card.reading ?? "";
    base.pos = card.pos ?? "";
    base.meaning = card.meaning ?? "";
  } else {
    base.connect = (card as any).connect ?? "";
    base.meaning = (card as any).meaning ?? "";
    base.feature = (card as any).feature ?? "";
    base.example = (card as any).example ?? "";
  }

  return base;
}

/** 单个 upsert：tag */
export async function cloudUpsertTag(tag: BatchTag) {
  const userId = await requireUserId();
  const { error } = await supabase.from("tags").upsert(tagPayload(userId, tag));
  if (error) throw error;
}

/** ✅ 批量 upsert：tags（更快） */
export async function cloudUpsertTags(tags: BatchTag[]) {
  const userId = await requireUserId();
  const payload = tags.map((t) => tagPayload(userId, t));
  const { error } = await supabase.from("tags").upsert(payload);
  if (error) throw error;
}

export async function cloudSoftDeleteTag(tagId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("tags")
    .update({ deleted: true, updated_at: now() })
    .eq("id", tagId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** 单个 upsert：card */
export async function cloudUpsertCard(card: AnyCard) {
  const userId = await requireUserId();
  const { error } = await supabase.from("cards").upsert(cardPayload(userId, card));
  if (error) throw error;
}

/** ✅ 批量 upsert：cards（更快） */
export async function cloudUpsertCards(cards: AnyCard[]) {
  const userId = await requireUserId();
  const payload = cards.map((c) => cardPayload(userId, c));
  const { error } = await supabase.from("cards").upsert(payload);
  if (error) throw error;
}

export async function cloudSoftDeleteCard(cardId: string) {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("cards")
    .update({ deleted: true, updated_at: now() })
    .eq("id", cardId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * 拉取云端所有数据（默认只拉 deleted=false）
 * 这样“云端软删除”的数据不会被再次拉回本机。
 */
export async function cloudPullAll(type: DeckType, opts?: { includeDeleted?: boolean }) {
  const userId = await requireUserId();
  const includeDeleted = opts?.includeDeleted ?? false;

  let qTags = supabase.from("tags").select("*").eq("user_id", userId).eq("type", type);
  let qCards = supabase.from("cards").select("*").eq("user_id", userId).eq("type", type);

  if (!includeDeleted) {
    qTags = qTags.eq("deleted", false);
    qCards = qCards.eq("deleted", false);
  }

  const { data: tags, error: e1 } = await qTags;
  if (e1) throw e1;

  const { data: cards, error: e2 } = await qCards;
  if (e2) throw e2;

  return { tags: tags ?? [], cards: cards ?? [] };
}
