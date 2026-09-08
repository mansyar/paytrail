import { headers } from "next/headers";
import NextLink from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOnboardingComplete } from "@/lib/onboarding";

export const metadata = { title: "Dashboard — PayTrail" };

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	// Mandatory onboarding gate: no dashboard until the business profile is done.
	if (!(await isOnboardingComplete(session.user.id))) {
		redirect("/onboarding");
	}

	const outstanding = await prisma.invoice.count({
		where: { userId: session.user.id, status: "SENT" },
	});

	return (
		<main>
			<h1>Dashboard</h1>
			<p>{session.user.email}</p>
			<p>
				<NextLink href="/invoices">Invoices</NextLink>
				{outstanding > 0 && ` (${outstanding} outstanding)`}
			</p>
			<p>
				<NextLink href="/clients">Clients</NextLink>
			</p>
			<p>
				<NextLink href="/profile">Profile</NextLink>
			</p>
			<SignOutButton />
		</main>
	);
}
