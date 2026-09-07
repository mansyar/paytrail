import { prisma } from "./db";

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
