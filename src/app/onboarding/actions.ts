"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { saveOnboardingData } from "@/lib/onboarding";
import { onboardingPayloadSchema } from "@/lib/schemas";

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Server-side re-validation + persistence of the onboarding wizard payload.
 * The client validates too, but the server never trusts it.
 */
export async function saveOnboardingAction(
	payload: unknown,
): Promise<SaveResult> {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return { ok: false, message: "You must be signed in." };
	}

	const parsed = onboardingPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		return {
			ok: false,
			message: "Some fields are invalid. Please review your entries.",
		};
	}

	try {
		await saveOnboardingData(session.user.id, parsed.data);
	} catch {
		return {
			ok: false,
			message: "Could not save your profile. Please try again.",
		};
	}
	return { ok: true };
}
