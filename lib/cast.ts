import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 公開ページ（HP）でキャストを引くときの共通条件。
 * ここに合わないキャストはトップ・一覧・詳細・店舗ページ・ランキング・
 * ギフト送付先・推し選択のすべてから除外される。
 *
 * 公開側で prisma.cast を引く箇所では必ずこれを通すこと。
 * 管理画面（ADMIN）だけが非公開・退職キャストを閲覧・編集できる。
 */
export const PUBLIC_CAST_WHERE = {
  isPublished: true,
  // 退職者はHPに出さない。表示FLGを落とし忘れても出ないようにしている
  retired: false,
} satisfies Prisma.CastWhereInput;

/** 指定IDのキャストが公開中かどうか（サーバー側の入力検証用） */
export async function isPublishedCast(id: string): Promise<boolean> {
  const cast = await prisma.cast.findFirst({
    where: { id, ...PUBLIC_CAST_WHERE },
    select: { id: true },
  });
  return cast !== null;
}

/**
 * その店舗のページに出すキャストを引く条件。
 *
 * 掛け持ちしていても、HPに出るのは主たる店舗（isPrimary）のページだけ。
 * 掛け持ち先はサブ扱いで、給与計算の対象にはなるがHPには出さない。
 */
export function castsOfStore(storeId: string): Prisma.CastWhereInput {
  return { stores: { some: { storeId, isPrimary: true } } };
}

/** その店舗のページに出す CastStore を引く条件（店舗側から辿るとき用） */
export function primaryCastsOfStoreWhere(): { isPrimary: boolean; cast: typeof PUBLIC_CAST_WHERE } {
  return { isPrimary: true, cast: PUBLIC_CAST_WHERE };
}

/** 主たる店舗を1件だけ取るための include。ランキング等の店舗名表示に使う */
export const PRIMARY_STORE_INCLUDE = {
  stores: {
    where: { isPrimary: true },
    take: 1,
    include: { store: { select: { name: true, slug: true } } },
  },
} satisfies Prisma.CastInclude;

/** PRIMARY_STORE_INCLUDE で取ったキャストから、主たる店舗の名前とスラッグを取り出す */
export function primaryStoreOf(cast: {
  stores: { store: { name: string; slug: string } }[];
}): { name: string; slug: string } {
  return cast.stores[0]?.store ?? { name: "", slug: "" };
}

/** 画面から店舗を1つ選ぶ形（旧 Cast.storeId）を、所属店舗の主たる1件として保存する */
type StoreWriter = {
  castStore: {
    updateMany: (args: {
      where: { castId: string };
      data: { isPrimary: boolean };
    }) => Promise<unknown>;
    upsert: (args: {
      where: { castId_storeId: { castId: string; storeId: string } };
      create: { castId: string; storeId: string; isPrimary: boolean };
      update: { isPrimary: boolean };
    }) => Promise<unknown>;
  };
};

/**
 * 主たる店舗を張り替える。
 * 掛け持ちのサブ店舗（給与側のエアレジ名から入ったもの）は消さずに残す。
 */
export async function setPrimaryStore(tx: StoreWriter, castId: string, storeId: string) {
  await tx.castStore.updateMany({ where: { castId }, data: { isPrimary: false } });
  await tx.castStore.upsert({
    where: { castId_storeId: { castId, storeId } },
    create: { castId, storeId, isPrimary: true },
    update: { isPrimary: true },
  });
}
