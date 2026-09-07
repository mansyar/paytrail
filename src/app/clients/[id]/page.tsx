import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ClientPageActions } from "@/components/clients/client-page-actions";
import { ProjectsSection } from "@/components/clients/projects-section";
import { auth } from "@/lib/auth";
import { getClient } from "@/lib/clients-repo";
import { listProjects } from "@/lib/projects-repo";

export const metadata = { title: "Client — PayTrail" };

export default async function ClientDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	const client = await getClient(session.user.id, id);
	if (!client) {
		notFound();
	}
	const projects = await listProjects(session.user.id, id);

	return (
		<Stack
			component="main"
			spacing={3}
			sx={{ p: { xs: 2, sm: 4 }, maxWidth: 960, mx: "auto" }}
		>
			<Stack
				direction="row"
				spacing={1}
				sx={{ alignItems: "center", justifyContent: "space-between" }}
			>
				<Button href="/clients" variant="text">
					← Clients
				</Button>
				<SignOutButton />
			</Stack>

			<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					spacing={2}
					sx={{ justifyContent: "space-between" }}
				>
					<Stack spacing={0.5}>
						<Typography component="h1" variant="h4">
							{client.name}
						</Typography>
						<Typography color="text.secondary" variant="body2">
							Currency: {client.currencyCode}
						</Typography>
					</Stack>
					<ClientPageActions
						client={{
							id: client.id,
							name: client.name,
							email: client.email,
							address: client.address,
							currencyCode: client.currencyCode,
							notes: client.notes,
						}}
					/>
				</Stack>
				<Divider sx={{ my: 2 }} />
				<Stack spacing={1}>
					<InfoRow label="Email" value={client.email} />
					<InfoRow label="Billing address" value={client.address} />
					<InfoRow label="Notes" value={client.notes} />
				</Stack>
			</Paper>

			<ProjectsSection
				clientId={client.id}
				projects={projects.map((project) => ({
					id: project.id,
					name: project.name,
					description: project.description,
				}))}
			/>
		</Stack>
	);
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
	return (
		<Stack
			direction={{ xs: "column", sm: "row" }}
			spacing={{ xs: 0.25, sm: 2 }}
		>
			<Typography color="text.secondary" sx={{ minWidth: 140 }} variant="body2">
				{label}
			</Typography>
			<Typography sx={{ whiteSpace: "pre-line" }} variant="body2">
				{value || "—"}
			</Typography>
		</Stack>
	);
}
