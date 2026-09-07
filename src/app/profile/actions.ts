"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
	addRateRule,
	deleteRateRule,
	reorderRateRules,
	updateProfileSettings,
	updateRateRule,
} from "@/lib/rate-rules";
import { businessProfileSchema, rateRuleSchema } from "@/lib/schemas";

export type ActionResult = { ok: true } | { ok: false; message: string };

async function requireUserId(): Promise<string | null> {
	const session = await auth.api.getSession({ headers: await headers() });
	return session?.user.id ?? null;
}

/** Server-side re-validated update of the business profile fields. */
export async function updateProfileAction(
	payload: unknown,
): Promise<ActionResult> {
	const userId = await requireUserId();
	if (!userId) return { ok: false, message: "You must be signed in." };
	const parsed = businessProfileSchema.safeParse(payload);
	if (!parsed.success) {
		return { ok: false, message: "Please fix the highlighted fields." };
	}
	await updateProfileSettings(userId, parsed.data);
	return { ok: true };
}

export type AddRuleResult =
	| { ok: true; id: string }
	| { ok: false; message: string };

/**
 * Append a blank rate rule (no client input to validate) and return its id
 * so the client can track the row.
 */
export async function addRateRuleAction(): Promise<AddRuleResult> {
	const userId = await requireUserId();
	if (!userId) return { ok: false, message: "You must be signed in." };
	const created = await addRateRule(userId, { keyword: "", rateMinor: 0 });
	return { ok: true, id: created.id };
}

export async function updateRateRuleAction(
	ruleId: string,
	rule: unknown,
): Promise<ActionResult> {
	const userId = await requireUserId();
	if (!userId) return { ok: false, message: "You must be signed in." };
	const parsed = rateRuleSchema.safeParse(rule);
	if (!parsed.success) {
		return { ok: false, message: "Invalid rate rule." };
	}
	try {
		await updateRateRule(userId, ruleId, parsed.data);
	} catch {
		return { ok: false, message: "Rate rule not found." };
	}
	return { ok: true };
}

export async function deleteRateRuleAction(
	ruleId: string,
): Promise<ActionResult> {
	const userId = await requireUserId();
	if (!userId) return { ok: false, message: "You must be signed in." };
	try {
		await deleteRateRule(userId, ruleId);
	} catch {
		return { ok: false, message: "Rate rule not found." };
	}
	return { ok: true };
}

const orderedIdsSchema = z.array(z.string()).min(1);

export async function reorderRateRulesAction(
	orderedIds: string[],
): Promise<ActionResult> {
	const userId = await requireUserId();
	if (!userId) return { ok: false, message: "You must be signed in." };
	const parsed = orderedIdsSchema.safeParse(orderedIds);
	if (!parsed.success) {
		return { ok: false, message: "Invalid rule order." };
	}
	try {
		await reorderRateRules(userId, parsed.data);
	} catch {
		return { ok: false, message: "Rate rule not found." };
	}
	return { ok: true };
}
