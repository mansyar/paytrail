import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { FxRate } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { getRate } from "./rate-service";

const PAIRS_TO_CLEAN = [
	{ baseCurrency: "USD", quoteCurrency: "EUR" },
	{ baseCurrency: "USD", quoteCurrency: "IDR" },
	{ baseCurrency: "USD", quoteCurrency: "JPY" },
];

beforeEach(async () => {
	await prisma.fxRate.deleteMany({
		where: { OR: PAIRS_TO_CLEAN.map((p) => ({ ...p })) },
	});
});

afterAll(async () => {
	await prisma.$disconnect();
});

function seedRate(
	base: string,
	quote: string,
	rate: string,
	hoursAgo: number,
): Promise<FxRate> {
	return prisma.fxRate.create({
		data: {
			baseCurrency: base,
			quoteCurrency: quote,
			rate: new Prisma.Decimal(rate),
			fetchedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
			source: "live",
		},
	});
}

describe("getRate", () => {
	it("returns 1 for identical currencies without fetching", async () => {
		const fetchJson = vi.fn();

		const rate = await getRate("USD", "usd", { fetchJson });

		expect(rate?.toNumber()).toBe(1);
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("derives the invoice-to-home multiplier from a fresh cached pair", async () => {
		// Raw provider rate: 1 USD = 0.8 EUR. Invoice in EUR, home USD ->
		// multiplier 1 / 0.8 = 1.25 (multiply EUR amounts to get USD).
		await seedRate("USD", "EUR", "0.8", 1);
		const fetchJson = vi.fn();

		const rate = await getRate("USD", "EUR", { fetchJson });

		expect(rate?.toNumber()).toBeCloseTo(1.25, 6);
		expect(fetchJson).not.toHaveBeenCalled();
	});

	it("refetches and upserts the full payload when the cache is stale", async () => {
		await seedRate("USD", "EUR", "0.8", 25);
		const fetchJson = vi.fn().mockResolvedValue({
			result: "success",
			rates: { EUR: 0.9, IDR: 16000, JPY: 150 },
		});

		const rate = await getRate("USD", "EUR", { fetchJson });

		expect(rate?.toNumber()).toBeCloseTo(1 / 0.9, 6);
		expect(fetchJson).toHaveBeenCalledTimes(1);
		// Every pair in the payload is now cached and fresh.
		const idr = await prisma.fxRate.findUnique({
			where: {
				baseCurrency_quoteCurrency: {
					baseCurrency: "USD",
					quoteCurrency: "IDR",
				},
			},
		});
		expect(idr?.rate.toString()).toBe("16000");
		const jpy = await prisma.fxRate.findUnique({
			where: {
				baseCurrency_quoteCurrency: {
					baseCurrency: "USD",
					quoteCurrency: "JPY",
				},
			},
		});
		expect(jpy?.rate.toString()).toBe("150");
	});

	it("falls back to the last cached rate when the provider fails", async () => {
		await seedRate("USD", "EUR", "0.8", 30);
		const fetchJson = vi.fn().mockRejectedValue(new Error("provider down"));

		const rate = await getRate("USD", "EUR", { fetchJson });

		expect(rate?.toNumber()).toBeCloseTo(1.25, 6);
	});

	it("returns null when there is no cache and the provider fails", async () => {
		const fetchJson = vi.fn().mockRejectedValue(new Error("provider down"));

		const rate = await getRate("USD", "EUR", { fetchJson });

		expect(rate).toBeNull();
	});
});
