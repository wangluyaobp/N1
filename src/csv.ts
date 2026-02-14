import Papa from "papaparse";
import { v4 as uuid } from "uuid";
import type { AnyCard, DeckType, GrammarCard, VocabCard } from "./types";
import { defaultSrs } from "./srs";

export type ImportResult = { tagId: string; tagName: string; cards: AnyCard[]; };

function must(value: unknown): string {
  return String(value ?? "").trim();
}

function requireColumns(obj: Record<string, unknown> | undefined, cols: string[]) {
  if (!obj) throw new Error("CSV 没有数据行（请确认不是空文件）");
  for (const c of cols) {
    if (!(c in obj)) throw new Error(`CSV 缺少列：${c}（请检查表头是否完全一致）`);
  }
}

export async function parseCsv(file: File, type: DeckType): Promise<ImportResult> {
  const text = await file.text();

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message || "CSV 解析失败");
  }

  const rows = parsed.data ?? [];
  const firstRow = rows[0];

  if (type === "vocab") {
    requireColumns(firstRow, ["单词", "读音（音调+假名）", "词性", "意思"]);
  } else {
    // ✅ 文法固定 5 列：文法 接续 意思 使用特性 例句
    requireColumns(firstRow, ["文法", "接续", "意思", "使用特性", "例句"]);
  }

  const now = Date.now();
  const tagId = uuid();

  const cards: AnyCard[] = rows
    .map((r) => {
      if (type === "vocab") {
        const c: VocabCard = {
          id: uuid(),
          type: "vocab",
          tagId,
          front: must(r["单词"]),
          reading: must(r["读音（音调+假名）"]),
          pos: must(r["词性"]),
          meaning: must(r["意思"]),
          srs: defaultSrs(),
          createdAt: now,
          updatedAt: now,
        };
        return c;
      } else {
        const c: GrammarCard = {
          id: uuid(),
          type: "grammar",
          tagId,
          front: must(r["文法"]),
          connect: must(r["接续"]),
          meaning: must(r["意思"]),
          feature: must(r["使用特性"]),   // ✅ 新增
          example: must(r["例句"]),
          srs: defaultSrs(),
          createdAt: now,
          updatedAt: now,
        };
        return c;
      }
    })
    .filter((c) => c.front.length > 0);

  const tagName = file.name.replace(/\.[^.]+$/, "");

  return { tagId, tagName, cards };
}
