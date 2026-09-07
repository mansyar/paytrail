import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isOnboardingComplete } from "@/lib/onboarding";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata = { title: "Set up your business — PayTrail" };

/** Only allow same-site relative redirect targets. */
function safeNextPath(next: string | undefined): string {
	if (next && /^\/(?!\/)/.test(next)) {
		return next;
	}
	return "/dashboard";
}

export default async function OnboardingPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	const { next } = await searchParams;

	// Already finished onboarding? Straight to the requested destination.
	if (await isOnboardingComplete(session.user.id)) {
		redirect(safeNextPath(next));
	}

	return <OnboardingWizard nextPath={safeNextPath(next)} />;
}
