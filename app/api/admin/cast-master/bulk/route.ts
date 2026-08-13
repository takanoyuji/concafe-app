import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCastCodeAllocator } from "@/lib/castCode";

// POST /api/admin/cast-master/bulk
// body: {
//   masters: { castCode?, hpName, rank?, retired?, tokyoAirRegi?, ... }[],
//   retireMissing?: boolean   // 既定 true。CSV に無い既存キャストを退職扱いにする
// }
//
// castCode をキーに upsert する（castCode が空の行は hpName で既存を探し、
// それでも見つからなければ新規採番する）。
// 以前は全件削除→再作成していたため、CastMonthlyRank が道連れで消え、
// retired も毎回リセットされていた。レコードを消さないことでどちらも起きない。

interface Row {
  castCode?: string;
  hpName?: string;
  rank?: string;
  retired?: boolean;
  tokyoAirRegi?: string;
  tokyoAirShift?: string;
  osakaAirRegi?: string;
  osakaAirShift?: string;
  nagoyaAirRegi?: string;
  nagoyaAirShift?: string;
}

/** 最初に見つかった重複値を返す。無ければ null */
function findDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return null;
}

/** 未指定(undefined)は「変更しない」の意味なので、そのまま undefined を渡す */
function trimmed(v: string | undefined): string | undefined {
  return v === undefined ? undefined : v.trim();
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: Row[] = body.masters ?? [];
  const retireMissing = body.retireMissing !== false;

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "masters は必須です" }, { status: 400 });

  // 同一CSV内の重複は照合を曖昧にする（別人の行を上書きしうる）ので、取り込まずに中止する
  const codes = rows.map(r => (r.castCode ?? "").trim()).filter(Boolean);
  const dupCode = findDuplicate(codes);
  if (dupCode)
    return NextResponse.json(
      { error: `キャストコードが重複しています: ${dupCode}` },
      { status: 400 }
    );

  const names = rows.map(r => (r.hpName ?? "").trim()).filter(Boolean);
  const dupName = findDuplicate(names);
  if (dupName)
    return NextResponse.json(
      { error: `HP名が重複しています: ${dupName}。キャストコード列を付けて取り込んでください` },
      { status: 400 }
    );

  const result = await prisma.$transaction(async tx => {
    const existing = await tx.castMaster.findMany();

    const byCode = new Map(existing.filter(m => m.castCode).map(m => [m.castCode, m]));

    // 既存側に同名が複数いる場合、その名前では一意に特定できないので照合に使わない
    const nameCount = new Map<string, number>();
    for (const m of existing) nameCount.set(m.hpName, (nameCount.get(m.hpName) ?? 0) + 1);
    const byName = new Map(
      existing.filter(m => m.hpName && nameCount.get(m.hpName) === 1).map(m => [m.hpName, m])
    );

    // CSV で明示されたコードも種に含めて、自動採番が既存・明示コードと衝突しないようにする
    const allocate = createCastCodeAllocator([...existing.map(m => m.castCode), ...codes]);

    const touched = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const r of rows) {
      const code = (r.castCode ?? "").trim();
      const name = (r.hpName ?? "").trim();

      const data = {
        hpName: trimmed(r.hpName),
        rank: trimmed(r.rank),
        retired: r.retired,
        tokyoAirRegi: trimmed(r.tokyoAirRegi),
        tokyoAirShift: trimmed(r.tokyoAirShift),
        osakaAirRegi: trimmed(r.osakaAirRegi),
        osakaAirShift: trimmed(r.osakaAirShift),
        nagoyaAirRegi: trimmed(r.nagoyaAirRegi),
        nagoyaAirShift: trimmed(r.nagoyaAirShift),
      };

      const match = code ? byCode.get(code) : name ? byName.get(name) : undefined;

      if (match) {
        await tx.castMaster.update({ where: { id: match.id }, data });
        touched.add(match.id);
        updated++;
      } else {
        await tx.castMaster.create({ data: { ...data, castCode: code || allocate() } });
        created++;
      }
    }

    // CSV に載っていない既存キャストを退職扱いにする（レコードは消さないので元に戻せる）
    let retiredCasts: { castCode: string; hpName: string }[] = [];
    if (retireMissing) {
      const missing = existing.filter(m => !touched.has(m.id) && !m.retired);
      if (missing.length > 0) {
        await tx.castMaster.updateMany({
          where: { id: { in: missing.map(m => m.id) } },
          data: { retired: true },
        });
        retiredCasts = missing.map(m => ({ castCode: m.castCode, hpName: m.hpName }));
      }
    }

    const masters = await tx.castMaster.findMany({ orderBy: { createdAt: "asc" } });
    return { created, updated, retiredCasts, masters };
  }, { timeout: 30000 });

  return NextResponse.json(result);
}
