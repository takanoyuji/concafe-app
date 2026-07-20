import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 公開ページ（HP）でキャストを引くときの共通条件。
 * isPublished=false のキャストはトップ・一覧・詳細・店舗ページ・ランキング・
 * ギフト送付先・推し選択のすべてから除外される。
 *
 * 公開側で prisma.cast / store.casts を引く箇所では必ずこれを通すこと。
 * 管理画面（ADMIN）だけが非公開キャストを閲覧・編集できる。
 */
export const PUBLIC_CAST_WHERE = { isPublished: true } satisfies Prisma.CastWhereInput;

/** 指定IDのキャストが公開中かどうか（サーバー側の入力検証用） */
export async function isPublishedCast(id: string): Promise<boolean> {
  const cast = await prisma.cast.findFirst({
    where: { id, ...PUBLIC_CAST_WHERE },
    select: { id: true },
  });
  return cast !== null;
}
