import { openDB } from "idb";
import type { AnyCard, BatchTag, DeckType } from "./types";

const DB_NAME = "srs-pwa-db";
const DB_VER = 1;

export const dbp = openDB(DB_NAME, DB_VER, {
  upgrade(db) {
    const tagStore = db.createObjectStore("tags", { keyPath: "id" });
    tagStore.createIndex("by_type", "type");

    const cardStore = db.createObjectStore("cards", { keyPath: "id" });
    cardStore.createIndex("by_type", "type");
    cardStore.createIndex("by_tag", "tagId");
    cardStore.createIndex("by_type_tag", ["type", "tagId"]);
  },
});

// ---- Tags ----
export async function listTags(type: DeckType): Promise<BatchTag[]> {
  const db: any = await dbp;
  return db.getAllFromIndex("tags", "by_type", type);
}

export async function putTag(tag: BatchTag) {
  const db: any = await dbp;
  await db.put("tags", tag);
}

export async function deleteTagAndCards(tagId: string) {
  const db: any = await dbp;
  const tx = db.transaction(["tags", "cards"], "readwrite");
  await tx.objectStore("tags").delete(tagId);

  const idx = tx.objectStore("cards").index("by_tag");
  let cursor = await idx.openCursor(tagId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ---- Cards ----
export async function listCardsByType(type: DeckType): Promise<AnyCard[]> {
  const db: any = await dbp;
  return db.getAllFromIndex("cards", "by_type", type) as AnyCard[];
}

export async function putCards(cards: AnyCard[]) {
  const db: any = await dbp;
  const tx = db.transaction("cards", "readwrite");
  for (const c of cards) await tx.store.put(c);
  await tx.done;
}

export async function putCard(card: AnyCard) {
  const db: any = await dbp;
  await db.put("cards", card);
}

export async function deleteCard(id: string) {
  const db: any = await dbp;
  await db.delete("cards", id);
}
