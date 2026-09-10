/**
 * 席予約（承認制・第1段階）の設定と、状態遷移のルール。
 *
 * ⚠️ 運用の数字は全部この SETTINGS に集めてある。店舗の運用が決まったらここだけ直す。
 *    画面・APIの各所に散らさないこと（散らすと片方だけ直して食い違う）。
 */

/**
 * 要件書 第6章「運用ルール」#1〜#5 に対する設定値。
 *
 * ⚠️ **すべて仮置きの既定値。** #6〜#11 は 2026-09-08 に確定したが、
 * この5つの数字はまだ現場と突き合わせていない。デプロイ前に差し替える。
 */
export const SETTINGS = {
  /** #2 何日先まで予約を受けるか */
  maxDaysAhead: 60,
  /**
   * #3 当日予約を受けるか。受ける場合、来店の何分前まで。
   * これを過ぎた当日の申し込みは、フォームでは受けずに公式LINEへ誘導する
   * （店長回答: 直前は公式LINEに連絡してもらうため、フォームで受ける必要はない）。
   */
  acceptSameDay: true,
  sameDayCutoffMinutes: 30,
  /** #4 1組の最大人数 */
  maxPartySize: 6,
  /** #5 承認の目安時間。これを過ぎた未対応は台帳で警告表示する */
  approveWithinHours: 3,
  /**
   * #5 返信できる時間帯。**0:00〜12:00 は返信できない**（店長回答）。
   * 承認の目安時間はこの時間帯だけを数える。数えないと、深夜に届いた申し込みが
   * 朝には全部 ⚠️ になり、警告が「いつも点いているランプ」になって意味を失う。
   */
  replyFrom: "12:00",
  replyTo: "24:00",
  /**
   * #1 受け付ける時間帯。第1段階では**営業時間をシステムに登録しない**ので、
   * ここは「フォームの選択肢に出す範囲」でしかない。営業時間外の申し込みは
   * 店舗が「お断り」にする運用（受付できない時間を選べなくするのは第2段階）。
   *
   * **#9 定休日・臨時休業はシステムで扱わないと決めた（2026-09-08）。**
   * 休みの日の申し込みも受け付けて、店舗が「お断り」で返す。休業日マスタは作らない。
   */
  openTime: "18:00",
  /** 最終受付。閉店時刻ではなく「この時刻の来店まで受ける」の意味 */
  closeTime: "22:00",
  /** 時間の刻み（分）。1時間刻み */
  stepMinutes: 60,
  /** いたずら対策: 同一電話番号の申し込み上限（直近 windowMinutes 分） */
  rateLimit: { windowMinutes: 30, maxPerPhone: 3, maxPerIp: 10 },
} as const;

/** 予約の状態。DBには文字列で入る */
export const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "DECLINED",
  "CANCELED",
  "VISITED",
  "NO_SHOW",
] as const;
export type ReservationStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING:   "未対応",
  CONFIRMED: "確定",
  DECLINED:  "お断り",
  CANCELED:  "キャンセル",
  VISITED:   "来店済み",
  NO_SHOW:   "無断キャンセル",
};

export const SOURCES = ["LINE", "PHONE", "OTHER"] as const;
export type ReservationSource = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  LINE:  "LINE",
  PHONE: "電話",
  OTHER: "その他",
};

/**
 * **#10 予約は一律で公式HPのフォームに寄せる（2026-09-08 確定）。**
 * 電話・DMで受けた分も、お客様にフォームからお申し込みいただく。
 * 全予約が同じ入口を通るので、台帳に穴が空かない。
 *
 * 管理画面の手入力は**例外用**として残してある（当日「今から2人いけますか」の電話など、
 * その場でフォームを開いてもらえないとき）。手入力は当日の締切と過去日の制限を受けない。
 */

/**
 * 状態の遷移。ここに無い遷移はAPIで弾く。
 * 「来店済みをキャンセルに戻す」のような、後から台帳の意味が変わる操作を止めるため。
 *
 * 運用として確定していること（要件書 第6章。無いのではなく、要らないと決めた）:
 * - **#7 キャンセルに期限は設けない。** 前日までといった締切は無く、確定後いつでもキャンセルにできる。
 *   日付での制限を足さないこと
 * - **#8 無断キャンセル（NO_SHOW）は記録するだけ。** その電話番号の次回以降の予約を
 *   制限する仕掛けは、意図的に入れていない。入れるなら店舗の判断を取り直すこと
 * - **#6 状態を変えられるのは管理画面に入れる人（ADMIN）だけ。** 承認担当は店長のみ
 */
export const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING:   ["CONFIRMED", "DECLINED", "CANCELED"],
  CONFIRMED: ["VISITED", "NO_SHOW", "CANCELED"],
  DECLINED:  [],
  CANCELED:  [],
  VISITED:   [],
  NO_SHOW:   [],
};

export function canTransition(from: string, to: string): boolean {
  if (!isStatus(from) || !isStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isStatus(v: string): v is ReservationStatus {
  return (STATUSES as readonly string[]).includes(v);
}

export function isSource(v: string): v is ReservationSource {
  return (SOURCES as readonly string[]).includes(v);
}

// ---- JST の日時 -------------------------------------------------------------
// サーバーのタイムゾーンはUTC。now() をそのまま使うと日付が1日ずれるので、
// JSTに直してから YYYY-MM-DD / HH:MM の文字列にする。

/** JSTの現在時刻を { date: "YYYY-MM-DD", time: "HH:MM" } で返す */
export function jstNow(now: Date = new Date()): { date: string; time: string } {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const iso = jst.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** "YYYY-MM-DD" に日数を足す */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "HH:MM" → 0時からの分 */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** フォームに出す時刻の選択肢（30分刻み） */
export function timeOptions(): string[] {
  const out: string[] = [];
  const end = toMinutes(SETTINGS.closeTime);
  for (let m = toMinutes(SETTINGS.openTime); m <= end; m += SETTINGS.stepMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

/** 電話番号を数字だけにする。+81 は 0 に戻す */
export function normalizePhone(input: string): string {
  const t = input.trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const digits = t.replace(/[^\d+]/g, "");
  if (digits.startsWith("+81")) return `0${digits.slice(3)}`;
  return digits.replace(/\D/g, "");
}

export function isValidPhone(normalized: string): boolean {
  return /^0\d{9,10}$/.test(normalized);
}

/**
 * 来店日時が受付範囲に入っているかを見る。
 * お客様のフォームからの申し込みにだけ効かせる（管理画面の手入力は過去日も入れられる。
 * 電話で受けた当日分を後から台帳に足す運用があるため）。
 */
export function checkVisitWindow(
  visitDate: string,
  visitTime: string,
  now: Date = new Date()
): { ok: true } | { ok: false; error: string } {
  const cur = jstNow(now);

  if (visitDate < cur.date) return { ok: false, error: "過去の日付は選べません" };

  if (visitDate > addDays(cur.date, SETTINGS.maxDaysAhead))
    return { ok: false, error: `ご予約は${SETTINGS.maxDaysAhead}日先まで承っています` };

  if (visitDate === cur.date) {
    if (!SETTINGS.acceptSameDay)
      return { ok: false, error: "当日のご予約は公式LINEからご連絡ください" };
    const remain = toMinutes(visitTime) - toMinutes(cur.time);
    if (remain < SETTINGS.sameDayCutoffMinutes)
      return {
        ok: false,
        // 弾いて終わりにしない。直前の申し込みは公式LINEで受ける運用なので、行き先を書く
        error: `このフォームでのご予約は来店の${SETTINGS.sameDayCutoffMinutes}分前までです。お急ぎの場合は公式LINEのトークからご連絡ください`,
      };
  }
  return { ok: true };
}

/**
 * from〜to のうち、**返信できる時間帯に入っている分数**を数える。
 *
 * 0:00〜12:00 は返信できないので、その間は承認の目安時間を進めない。
 * 例: 23:00 に届いた申し込みは、24:00 までの1時間を数えたあと翌12:00 まで止まり、
 * 翌14:00 に3時間へ到達する。
 */
export function replyableMinutes(from: Date, to: Date): number {
  if (to <= from) return 0;
  const start = toMinutes(SETTINGS.replyFrom);
  const end = toMinutes(SETTINGS.replyTo);

  // JSTの「0時からの通算分」に直してから、1日ずつ重なりを足す
  const JST = 9 * 60 * 60 * 1000;
  const f = Math.floor((from.getTime() + JST) / 60_000);
  const t = Math.floor((to.getTime() + JST) / 60_000);

  let minutes = 0;
  for (let day = Math.floor(f / 1440) * 1440; day < t; day += 1440) {
    const s = Math.max(f, day + start);
    const e = Math.min(t, day + end);
    if (e > s) minutes += e - s;
  }
  return minutes;
}

/** 未対応が承認目安を過ぎているか（台帳の警告表示用） */
export function isOverdue(status: string, createdAt: Date, now: Date = new Date()): boolean {
  if (status !== "PENDING") return false;
  return replyableMinutes(createdAt, now) > SETTINGS.approveWithinHours * 60;
}

/**
 * 入力された購入IDが BASE の注文IDらしい形かを判定する。
 *
 * BASE の注文IDは16進16桁の大文字（例 `1AE7F1F358D8940C`）。
 * **これは弾くための判定ではない。** 照合はしていないので真偽は分からず、
 * 「明らかに形が違う」ことを台帳で店舗に伝えるためだけに使う。
 * false でも予約は受け付けるし、true でも購入した証明にはならない。
 */
export function looksLikeBasePurchaseId(value: string): boolean {
  return /^[0-9A-F]{16}$/.test(value.trim().toUpperCase());
}

/** 購入IDの保存形。前後の空白を落とし、大文字に寄せる（照合するときの表記ゆれを減らす） */
export function normalizePurchaseId(value: string): string {
  return value.trim().toUpperCase();
}
