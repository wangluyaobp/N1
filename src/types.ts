export type DeckType = "vocab" | "grammar";

export type BatchTag = {
  id: string;
  type: DeckType;
  name: string;
  createdAt: number;
};

export type SRS = {
  ease: number;        // 初始 2.5
  interval: number;    // 天
  repetitions: number; // 连续记住次数
  dueAt: number;       // 下次复习时间戳；新卡=0
  lastReviewedAt?: number;
  lapses: number;
};

export type VocabCard = {
  id: string;
  type: "vocab";
  tagId: string;
  front: string;     // 单词
  reading: string;   // 读音（音调+假名）
  pos: string;       // 词性
  meaning: string;   // 意思
  srs: SRS;
  createdAt: number;
  updatedAt: number;
};

export type GrammarCard = {
  id: string;
  type: "grammar";
  tagId: string;
  front: string;     // 文法
  connect: string;   // 接续
  meaning: string;   // 意思
  feature: string;   // ✅ 使用特性（新增）
  example: string;   // 例句
  srs: SRS;
  createdAt: number;
  updatedAt: number;
};

export type AnyCard = VocabCard | GrammarCard;
