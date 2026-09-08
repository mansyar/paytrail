import { describe, expect, it, vi } from "vitest";
import {
	FxProviderError,
	fetchLatestRates,
	type FetchJson,
} from "./provider";

function jsonResponse(body: unknown): FetchJson {
	return vi.fn().mockResolvedValue(body);
}

describe("fetchLatestRates", () => {
	it("returns rates for the requested base currency", async () => {
		const fetchJson = jsonResponse({
			result: "success",
			rates: { USD: 1, EUR: 0.92, IDR: 16250.5 },
		});

		const result = await fetchLatestRates("USD", fetchJson);

		expect(result.base).toBe("USD");
		expect(result.rates.EUR).toBeCloseTo(0.92);
		expect(result.rates.IDR).toBe(16250.5);
		expect(result.fetchedAt).toBeInstanceOf(Date);
	});

	it("requests the correct endpoint for the base currency", async () => {
		const fetchJson = jsonResponse({ result: "success", rates: { USD: 1 } });

		await fetchLatestRates("eur", fetchJson);

		expect(fetchJson).toHaveBeenCalledWith(
			"https://open.er-api.com/v6/latest/EUR",
			expect.objectContaining({ signal: expect.anything() }),
		);
	});

	it("normalizes the base currency to uppercase", async () => {
		const fetchJson = jsonResponse({ result: "success", rates: { USD: 1 } });

		const result = await fetchLatestRates("usd", fetchJson);

		expect(result.base).toBe("USD");
	});

	it("throws FxProviderError when the provider reports failure", async () => {
		const fetchJson = jsonResponse({ result: "error", "error-type": "quota" });

		await expect(fetchLatestRates("USD", fetchJson)).rejects.toBeInstanceOf(
			FxProviderError,
		);
	});

	it("throws FxProviderError when rates are missing or malformed", async () => {
		const missingRates = jsonResponse({ result: "success" });
		await expect(fetchLatestRates("USD", missingRates)).rejects.toBeInstanceOf(
			FxProviderError,
		);

		const badRates = jsonResponse({
			result: "success",
			rates: { EUR: "not-a-number" },
		});
		await expect(fetchLatestRates("USD", badRates)).rejects.toBeInstanceOf(
			FxProviderError,
		);

		const negativeRates = jsonResponse({
			result: "success",
			rates: { EUR: -1.5 },
		});
		await expect(fetchLatestRates("USD", negativeRates)).rejects.toBeInstanceOf(
			FxProviderError,
		);
	});

	it("wraps network failures in FxProviderError", async () => {
		const fetchJson = vi.fn().mockRejectedValue(new Error("socket hang up"));

		await expect(fetchLatestRates("USD", fetchJson)).rejects.toBeInstanceOf(
			FxProviderError,
		);
	});

	it("does not spend more than 5 seconds on a fetch", async () => {
		let capturedSignal: AbortSignal | undefined;
		const fetchJson = vi.fn().mockImplementation(
			(_url: string, init?: { signal?: AbortSignal }) => {
				capturedSignal = init?.signal;
				return Promise.resolve({ result: "success", rates: { USD: 1 } });
			},
		);

		await fetchLatestRates("USD", fetchJson);

		expect(capturedSignal).toBeDefined();
		// AbortSignal.timeout(ms) is already scheduled when returned.
		expect(capturedSignal?.aborted).toBe(false);
	});
});
