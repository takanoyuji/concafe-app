import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
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
  bio: z.string().min(1, "プロフィールは必須です"),
  imageUrl: z.string().min(1, "画像URLは必須です"),
  storeId: z.string().min(1, "店舗は必須です"),
  order: z.number().int().default(0),
  twitterUrl: z.string().nullish(),
  instagramUrl: z.string().nullish(),
  tiktokUrl: z.string().nullish(),
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
