import type { AnyCard, BatchTag, DeckType } from "./types";
import { cloudPullAll } from "./cloud";
import { putCards, putTag, deleteCard, deleteTagAndCards } from "./db";

export async function syncFromCloud(type: DeckType) {
  const { tags, cards } = await cloudPullAll(type);

  // tags
  for (const t of tags as any[]) {
    if (t.deleted) {
      await deleteTagAndCards(t.id);
      continue;
    }
    const tag: BatchTag = { id: t.id, type: t.type, name: t.name, createdAt: t.created_at };
    await putTag(tag);
  }

  // cards
  const upserts: AnyCard[] = [];
  for (const c of cards as any[]) {
    if (c.deleted) {
      await deleteCard(c.id);
      continue;
    }

    const common = {
      id: c.id,
      type: c.type,
      tagId: c.tag_id,
      front: c.front,
      srs: c.srs,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };

    if (c.type === "vocab") {
      upserts.push({
        ...(common as any),
        reading: c.reading ?? "",
        pos: c.pos ?? "",
        meaning: c.meaning ?? "",
      });
    } else {
      upserts.push({
        ...(common as any),
        connect: c.connect ?? "",
        meaning: c.meaning ?? "",
        feature: c.feature ?? "",
        example: c.example ?? "",
      });
    }
  }

  await putCards(upserts);
}

// ✅ 新增：同步全部（单词 + 文法）
export async function syncAllFromCloud() {
  await syncFromCloud("vocab");
  await syncFromCloud("grammar");
}
