import type { SRS } from "./types";

export function defaultSrs(): SRS {
  return { ease: 2.5, interval: 0, repetitions: 0, dueAt: 0, lapses: 0 };
}

export function sm2Update(srs: SRS, quality: 0|1|2|3|4|5, now = Date.now()): SRS {
  let ease = srs.ease ?? 2.5;
  let reps = srs.repetitions ?? 0;
  let interval = srs.interval ?? 0;
  let lapses = srs.lapses ?? 0;

  if (quality < 3) {
    reps = 0;
    interval = 1;
    lapses += 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.max(1, Math.round(interval * ease));
    reps += 1;
  }

  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  const dueAt = now + interval * 24 * 60 * 60 * 1000;

  return { ease, repetitions: reps, interval, dueAt, lastReviewedAt: now, lapses };
}

export function pickStudyQueue<T extends { srs: SRS }>(
  cards: T[],
  now = Date.now(),
  limit = 30,
  newRatio = 0.2
): T[] {
  const due = cards.filter(c => (c.srs?.dueAt ?? 0) !== 0 && (c.srs.dueAt ?? 0) <= now);
  const fresh = cards.filter(c => (c.srs?.dueAt ?? 0) === 0);

  due.sort((a,b)=> (a.srs.dueAt ?? 0) - (b.srs.dueAt ?? 0));

  const newCount = Math.min(fresh.length, Math.max(0, Math.round(limit * newRatio)));
  const dueCount = Math.min(due.length, Math.max(0, limit - newCount));

  // 洗牌新卡
  const shuffled = [...fresh];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return [...due.slice(0, dueCount), ...shuffled.slice(0, newCount)];
}
