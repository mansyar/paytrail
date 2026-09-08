import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { type FetchJson, fetchLatestRates } from "./provider";

/**
 * FX rate service (fx_multi_currency_20260908).
 *
 * Returns the multiplier that converts amounts in `invoiceCurrency` to the
 * account home currency (`homeCurrency`): multiply by the result.
 *
 * Semantics (spec FR3):
 * - same currency -> Decimal(1), no fetch
 * - cached pair younger than 24h -> derived from cache, no fetch
 * - stale or missing -> fetch the full payload for the home base, upsert
 *   every pair (the cache doubles as the last-known-rate fallback store)
 * - provider failure -> fall back to the last cached rate of any age
 * - no cache and provider failure -> null (callers surface the manual
 *   override path)
 *
 * Cache rows store RAW provider rates: rate = units of quote per 1 unit of
 * base (e.g. USD base, EUR quote, 0.9 => 1 USD buys 0.9 EUR). The derived
 * invoice-to-home multiplier is 1 / raw.
 */

const RATE_TTL_MS = 24 * 60 * 60 * 1000;

const defaultFetchJson: FetchJson = async (url, init) => {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(`FX provider responded with HTTP ${response.status}`);
	}
	return response.json();
};

export interface GetRateDeps {
	fetchJson?: FetchJson;
	prismaClient?: Pick<Prisma.TransactionClient, "fxRate" | "$transaction">;
}

export async function getRate(
	homeCurrency: string,
	invoiceCurrency: string,
	deps: GetRateDeps = {},
): Promise<Prisma.Decimal | null> {
	const home = homeCurrency.toUpperCase();
	const invoice = invoiceCurrency.toUpperCase();
	const db = deps.prismaClient ?? prisma;
	const fetchJson = deps.fetchJson ?? defaultFetchJson;

	if (home === invoice) {
		return new Prisma.Decimal(1);
	}

	const cached = await db.fxRate.findUnique({
		where: {
			baseCurrency_quoteCurrency: {
				baseCurrency: home,
				quoteCurrency: invoice,
			},
		},
	});

	const isFresh =
		cached !== null && Date.now() - cached.fetchedAt.getTime() < RATE_TTL_MS;
	if (isFresh) {
		return deriveMultiplier(cached.rate);
	}

	try {
		const latest = await fetchLatestRates(home, fetchJson);
		const raw = latest.rates[invoice];
		if (raw === undefined) {
			throw new Error(
				`FX provider payload for ${home} does not include ${invoice}`,
			);
		}

		await refreshRatePayload(db, latest.base, latest.rates);
		return new Prisma.Decimal(1).div(raw);
	} catch {
		// Provider unreachable or payload unusable: last-known rate wins.
		return cached !== null ? deriveMultiplier(cached.rate) : null;
	}
}

/** Replace every cached pair for `base` with the fresh payload (atomic). */
async function refreshRatePayload(
	db: Pick<Prisma.TransactionClient, "fxRate" | "$transaction">,
	base: string,
	rates: Record<string, number>,
): Promise<void> {
	const entries = Object.entries(rates);
	if (entries.length === 0) return;

	const fetchedAt = new Date();
	await db.$transaction([
		db.fxRate.deleteMany({ where: { baseCurrency: base } }),
		db.fxRate.createMany({
			data: entries.map(([quote, rate]) => ({
				baseCurrency: base,
				quoteCurrency: quote,
				rate: new Prisma.Decimal(rate),
				fetchedAt,
				source: "live",
			})),
		}),
	]);
}

function deriveMultiplier(rawRate: Prisma.Decimal): Prisma.Decimal {
	return new Prisma.Decimal(1).div(rawRate);
}
