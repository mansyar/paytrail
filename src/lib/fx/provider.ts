import { z } from "zod";

/**
 * FX provider client (fx_multi_currency_20260908).
 *
 * Talks to open.er-api.com (free, no API key) to fetch the full rate payload
 * for one base currency. Responses are Zod-validated before they leave this
 * module; every failure mode surfaces as FxProviderError. The fetch function
 * is injectable so tests run without network access.
 */

const PROVIDER_ENDPOINT = "https://open.er-api.com/v6/latest";
const TIMEOUT_MS = 5_000;

export class FxProviderError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "FxProviderError";
	}
}

/** Shape the provider promises: { result: "success", rates: { ... } } */
const providerResponseSchema = z.object({
	result: z.literal("success"),
	rates: z.record(z.string(), z.number().positive().finite()),
});

export type ProviderRates = z.infer<typeof providerResponseSchema>;

export type FetchJson = (
	url: string,
	init?: { signal?: AbortSignal },
) => Promise<unknown>;

export interface LatestRates {
	base: string;
	rates: Record<string, number>;
	fetchedAt: Date;
}

/** Fetch the full rate payload for `base` (e.g. "USD" -> { EUR: 0.92, ... }). */
export async function fetchLatestRates(
	base: string,
	fetchJson: FetchJson,
): Promise<LatestRates> {
	const normalizedBase = base.toUpperCase();
	const url = `${PROVIDER_ENDPOINT}/${normalizedBase}`;

	let body: unknown;
	try {
		body = await fetchJson(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch (error) {
		throw new FxProviderError(`FX rate fetch failed for ${normalizedBase}`, {
			cause: error,
		});
	}

	const parsed = providerResponseSchema.safeParse(body);
	if (!parsed.success) {
		throw new FxProviderError(
			`FX provider returned an invalid response for ${normalizedBase}`,
			{ cause: parsed.error },
		);
	}

	return {
		base: normalizedBase,
		rates: parsed.data.rates,
		fetchedAt: new Date(),
	};
}
