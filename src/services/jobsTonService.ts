// JOBS_BOT's own TON deposit scanner — deliberately a separate file from
// src/services/ton-service.ts (AD_BOT) and src/services/marriageTonService.ts
// (MARRIAGE_BOT), not an import of their internals, so nothing here ever
// touches another bot's live money-handling code and vice versa (owner
// directive, 2026-09-05).
//
// Same shared hot wallet (MASTER_HOT_WALLET_ADDRESS) as the other bots —
// real on-chain custody is necessarily pooled — but deposits are matched
// by a JOBS_BOT-only memo (JobsUser.tonMemo) and credited to
// JobsUser.balance/JobsTransaction only, never another bot's tables.
import { Address, Cell, fromNano } from "@ton/core";
import { TonClient } from "@ton/ton";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TON_API_ENDPOINT =
  process.env.TON_NETWORK === "testnet"
    ? "https://testnet.toncenter.com/api/v2/jsonRPC"
    : "https://toncenter.com/api/v2/jsonRPC";

let cachedClient: TonClient | null = null;
function getClient(): TonClient {
  if (!cachedClient) {
    cachedClient = new TonClient({ endpoint: TON_API_ENDPOINT, apiKey: process.env.TON_API_KEY });
  }
  return cachedClient;
}

function generateMemo(): string {
  return crypto.randomBytes(6).toString("hex");
}

export async function getOrCreateJobsTonMemo(userId: string): Promise<string> {
  const existing = await prisma.jobsUser.findUnique({ where: { id: userId }, select: { tonMemo: true } });
  if (existing?.tonMemo) return existing.tonMemo;
  let memo = generateMemo();
  for (let i = 0; i < 5 && (await prisma.jobsUser.findUnique({ where: { tonMemo: memo } })); i++) {
    memo = generateMemo();
  }
  await prisma.jobsUser.update({ where: { id: userId }, data: { tonMemo: memo } });
  return memo;
}

const TON_USD_FALLBACK_RATE = 5;
async function getTonUsdRate(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd", {
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const rate = Number(data?.["the-open-network"]?.usd);
    return rate > 0 ? rate : TON_USD_FALLBACK_RATE;
  } catch {
    return TON_USD_FALLBACK_RATE;
  }
}

function extractComment(body: Cell): string | null {
  try {
    const slice = body.beginParse();
    if (slice.remainingBits < 32) return null;
    const op = slice.loadUint(32);
    if (op !== 0) return null;
    const text = slice.loadStringTail().trim();
    return text || null;
  } catch {
    return null;
  }
}

// Same daily-cron cadence limitation as the other bots' scanners (Vercel
// Hobby cron caps at once/day) — see /api/cron/jobs-ton-deposits.
export async function scanJobsTonDeposits(): Promise<{ scanned: number; credited: number }> {
  const hotWallet = process.env.MASTER_HOT_WALLET_ADDRESS;
  if (!hotWallet) throw new Error("MASTER_HOT_WALLET_ADDRESS is not configured");
  const client = getClient();
  const address = Address.parse(hotWallet);
  const transactions = await client.getTransactions(address, { limit: 50 });

  let credited = 0;
  for (const tx of transactions) {
    const inMsg = tx.inMessage;
    if (!inMsg || inMsg.info.type !== "internal") continue;
    const valueNano = inMsg.info.value.coins;
    if (valueNano <= BigInt(0)) continue;
    const comment = extractComment(inMsg.body);
    if (!comment) continue;

    const user = await prisma.jobsUser.findUnique({ where: { tonMemo: comment } });
    if (!user) continue; // not a JOBS_BOT memo — leave it for the other bots' own scanners (or ignore)

    const txHash = tx.hash().toString("hex");
    const amountTon = Number(fromNano(valueNano));
    const rate = await getTonUsdRate();
    const usdValue = Math.round(amountTon * rate * 100) / 100;
    if (usdValue <= 0) continue;

    try {
      await prisma.$transaction([
        prisma.jobsUser.update({ where: { id: user.id }, data: { balance: { increment: usdValue } } }),
        prisma.jobsTransaction.create({
          data: { userId: user.id, amount: usdValue, currency: "TON", type: "DEPOSIT", status: "COMPLETED", txHash },
        }),
      ]);
      credited++;
    } catch {
      // Unique constraint on txHash — already credited on a previous scan.
    }
  }
  return { scanned: transactions.length, credited };
}
