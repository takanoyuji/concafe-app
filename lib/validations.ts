import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  birthdate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "生年月日の形式が正しくありません")
    .refine((d) => {
      const date = new Date(d);
      return !isNaN(date.getTime()) && date < new Date();
    }, "生年月日が正しくありません"),
  nickname: z.string().min(1, "ニックネームは必須です").max(20, "ニックネームは20文字以内で入力してください"),
  favoriteCast1Id: z.string().min(1, "推しキャスト1は必須です"),
  favoriteCast2Id: z.string().optional(),
  favoriteStoreId: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

export const CastSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  bio: z.string().min(1, "一言は必須です"),
  imageUrl: z.string().min(1, "画像URLは必須です"),
  storeId: z.string().min(1, "店舗は必須です"),
  order: z.number().int().default(0),
  isPublished: z.boolean().default(true),
  retired: z.boolean().default(false),
  twitterUrl: z.string().nullish(),
  instagramUrl: z.string().nullish(),
  tiktokUrl: z.string().nullish(),
  airShiftName: z.string().nullish(),
  // ランクは未設定を空文字で表す（給与計算が空文字を「ランクなし」として扱うため）
  rank: z.string().nullish().transform(v => v ?? ""),
  exemptFromCommuteRule: z.boolean().default(false),
});

export const GrantPointsSchema = z.object({
  toUserId: z.string().optional(),
  email: z.string().email().optional(),
  amount: z.number().int().positive("1以上のポイントを指定してください"),
  idempotencyKey: z.string().min(1),
}).refine((d) => d.toUserId || d.email, {
  message: "toUserId または email のどちらかが必要です",
});

export const GiftPointsSchema = z.object({
  castId: z.string().min(1),
  amount: z.number().int().positive("1以上のポイントを指定してください"),
  idempotencyKey: z.string().min(1),
});

export const TitleSchema = z.object({
  name: z.string().min(1, "称号名は必須です"),
  threshold: z.number().int().min(0, "閾値は0以上で入力してください"),
  order: z.number().int().default(0),
});

/**
 * 席予約の申し込み（お客様向けフォーム）。
 * 会員登録は不要なので、本人を特定できるのは氏名と電話番号だけ。両方必須にする。
 */
export const ReservationSchema = z.object({
  storeId: z.string().min(1, "店舗を選んでください"),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "来店日を選んでください"),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/, "来店時間を選んでください"),
  partySize: z.number().int().min(1, "人数を選んでください"),
  customerName: z.string().min(1, "お名前は必須です").max(50, "お名前は50文字以内で入力してください"),
  phone: z.string().min(1, "電話番号は必須です"),
  /// 遠隔ドリンクの購入ID（任意・自己申告）。承認の優先に使う。
  /// **形式が違っても弾かない。** BASE以外の経路や表記ゆれで申し込めなくなるほうが損なため。
  /// BASEの注文IDらしいかの判定は looksLikeBasePurchaseId() が行い、台帳の表示にだけ使う
  purchaseId: z.string().max(64, "購入IDは64文字以内で入力してください").optional().default(""),
  // 自由記述は受けない。氏名・電話・日時・人数・購入IDだけを受ける。
  // 席の希望・記念日・自由記述は受け付けない（2026-09-10 決定）。
  // zod は未知のキーを落とすので、直接POSTされても note は保存されない
});

/**
 * 管理画面からの手入力（電話・DMで受けた予約）。
 * 受付経路を選べる点と、過去日も入れられる点がお客様向けと違う。
 */
export const AdminReservationSchema = ReservationSchema.extend({
  /// 電話・DMで聞いた内容を店舗が書き留めるためのメモ。お客様は入力できない
  note: z.string().max(500, "メモは500文字以内で入力してください").optional().default(""),
  source: z.enum(["LINE", "PHONE", "OTHER"]).default("PHONE"),
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
});

/** 台帳での状態変更 */
export const ReservationStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "CANCELED", "VISITED", "NO_SHOW"]),
  memo: z.string().max(200).optional().default(""),
});
