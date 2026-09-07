import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOnboardingComplete } from "@/lib/onboarding";
import type { BusinessProfileInput } from "@/lib/schemas";
import { ProfileEditor } from "./profile-editor";

export const metadata = { title: "Profile — PayTrail" };

export default async function ProfilePage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/login");
	}

	// The profile page assumes onboarding is done; the gate owns that.
	if (!(await isOnboardingComplete(session.user.id))) {
		redirect("/onboarding");
	}

	const [profile, rules] = await Promise.all([
		prisma.businessProfile.findUnique({
			where: { userId: session.user.id },
		}),
		prisma.rateRule.findMany({
			where: { userId: session.user.id },
			orderBy: { sortOrder: "asc" },
		}),
	]);

	if (!profile) {
		// The gate guarantees a completed profile; bail out to onboarding if not.
		redirect("/onboarding");
	}

	return (
		<ProfileEditor
			initialProfile={{
				businessName: profile.businessName,
				addressLine1: profile.addressLine1 ?? "",
				addressLine2: profile.addressLine2 ?? "",
				city: profile.city ?? "",
				postalCode: profile.postalCode ?? "",
				contactEmail: profile.contactEmail ?? "",
				taxId: profile.taxId ?? "",
				logo: profile.logo ?? "",
				// Safe: currency values only ever come from the validated CURRENCIES list.
				currency: profile.currency as BusinessProfileInput["currency"],
				defaultTaxRate: profile.defaultTaxRate.toFixed(2),
				paymentTerms: profile.paymentTerms ?? "due_on_receipt",
			}}
			initialRules={rules.map((rule) => ({
				id: rule.id,
				keyword: rule.keyword,
				rate: (rule.rateMinor / 100).toFixed(2),
			}))}
		/>
	);
}
