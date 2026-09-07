import { prisma } from "./db";
import type { OnboardingPayload } from "./schemas";

/**
 * Session-scoped onboarding gate check.
 * A user may pass through only once their business profile is marked complete.
 */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
	const profile = await prisma.businessProfile.findUnique({
		where: { userId },
		select: { onboardingCompleted: true },
	});
	return profile?.onboardingCompleted ?? false;
}

/**
 * Persist the onboarding payload: upsert the business profile and replace all
 * rate rules in a single transaction. Callers must re-validate the payload
 * with onboardingPayloadSchema server-side before invoking this.
 */
export async function saveOnboardingData(
	userId: string,
	payload: OnboardingPayload,
): Promise<void> {
	const { profile, rateRules } = payload;

	const data = {
		businessName: profile.businessName,
		addressLine1: profile.addressLine1 ?? null,
		addressLine2: profile.addressLine2 ?? null,
		city: profile.city ?? null,
		postalCode: profile.postalCode ?? null,
		contactEmail: profile.contactEmail ?? null,
		taxId: profile.taxId ?? null,
		logo: profile.logo ?? null,
		currency: profile.currency,
		defaultTaxRate: Number(profile.defaultTaxRate),
		paymentTerms: profile.paymentTerms ?? null,
		onboardingCompleted: true,
	};

	await prisma.$transaction(async (tx) => {
		await tx.businessProfile.upsert({
			where: { userId },
			update: data,
			create: { ...data, userId },
		});
		await tx.rateRule.deleteMany({ where: { userId } });
		if (rateRules.length > 0) {
			await tx.rateRule.createMany({
				data: rateRules.map((rule, sortOrder) => ({
					userId,
					keyword: rule.keyword,
					rateMinor: rule.rateMinor,
					sortOrder,
				})),
			});
		}
	});
}
