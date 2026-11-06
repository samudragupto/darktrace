import { NextResponse } from "next/server";

/** "Was I sandwiched?" lookup: wallet address -> /lp/[address], receipt hash -> /receipt/[hash]. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return NextResponse.redirect(new URL(`/lp/${q}`, url));
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) return NextResponse.redirect(new URL(`/receipt/${q.toLowerCase()}`, url));
  return NextResponse.redirect(new URL(`/?lookup=invalid`, url));
}
