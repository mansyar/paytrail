import { prisma } from "./db";
import type { BusinessProfileData, RateRuleData } from "./schemas";

function profileDataToDb(data: BusinessProfileData) {
	return {
		businessName: data.businessName,
		addressLine1: data.addressLine1 ?? null,
		addressLine2: data.addressLine2 ?? null,
		city: data.city ?? null,
		postalCode: data.postalCode ?? null,
		contactEmail: data.contactEmail ?? null,
		taxId: data.taxId ?? null,
		logo: data.logo ?? null,
		currency: data.currency,
		defaultTaxRate: Number(data.defaultTaxRate),
		paymentTerms: data.paymentTerms ?? null,
	};
}

/** Update the user's business profile fields. Requires an existing profile. */
export async function updateProfileSettings(
	userId: string,
	data: BusinessProfileData,
): Promise<void> {
	await prisma.businessProfile.update({
		where: { userId },
		data: { ...profileDataToDb(data), onboardingCompleted: true },
	});
}

/** Reject when the user already has a rule with the same keyword (case-insensitive). */
export async function assertUniqueKeyword(
	userId: string,
	keyword: string,
	excludeId?: string,
): Promise<void> {
	const duplicate = await prisma.rateRule.findFirst({
		where: {
			userId,
			keyword: { equals: keyword.trim(), mode: "insensitive" },
			...(excludeId ? { id: { not: excludeId } } : {}),
		},
		select: { id: true },
	});
	if (duplicate) {
		throw new Error("A rate rule with this keyword already exists");
	}
}

/** Append a rate rule after the user's existing ones. */
export async function addRateRule(
	userId: string,
	rule: RateRuleData,
): Promise<{ id: string }> {
	// Known limitation: two concurrent adds for the same user can compute the
	// same max+1 sortOrder. Ordering-only impact (no data loss); acceptable
	// for a single-user profile page.
	const last = await prisma.rateRule.findFirst({
		where: { userId },
		orderBy: { sortOrder: "desc" },
		select: { sortOrder: true },
	});
	return prisma.rateRule.create({
		data: {
			userId,
			keyword: rule.keyword,
			rateMinor: rule.rateMinor,
			sortOrder: (last?.sortOrder ?? -1) + 1,
		},
		select: { id: true },
	});
}

/** Update keyword/rate of a rule owned by the user. Throws when not found. */
export async function updateRateRule(
	userId: string,
	ruleId: string,
	patch: { keyword?: string; rateMinor?: number },
): Promise<void> {
	const result = await prisma.rateRule.updateMany({
		where: { id: ruleId, userId },
		data: patch,
	});
	if (result.count === 0) {
		throw new Error("Rate rule not found");
	}
}

/** Delete a rule owned by the user. Throws when not found. */
export async function deleteRateRule(
	userId: string,
	ruleId: string,
): Promise<void> {
	const result = await prisma.rateRule.deleteMany({
		where: { id: ruleId, userId },
	});
	if (result.count === 0) {
		throw new Error("Rate rule not found");
	}
}

/** Reorder the user's rules so each id gets its index as sortOrder. */
export async function reorderRateRules(
	userId: string,
	orderedIds: string[],
): Promise<void> {
	const owned = await prisma.rateRule.count({
		where: { id: { in: orderedIds }, userId },
	});
	if (owned !== orderedIds.length) {
		throw new Error("Rate rule not found");
	}
	await prisma.$transaction(
		orderedIds.map((id, index) =>
			prisma.rateRule.update({
				where: { id },
				data: { sortOrder: index },
			}),
		),
	);
}
