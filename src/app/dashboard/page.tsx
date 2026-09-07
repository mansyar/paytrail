import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { auth } from "@/lib/auth";

export const metadata = { title: "Dashboard — PayTrail" };

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	return (
		<main>
			<h1>Dashboard</h1>
			<p>{session.user.email}</p>
			<p>
				<a href="/clients">Clients</a>
			</p>
			<SignOutButton />
		</main>
	);
}
