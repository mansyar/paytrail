import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ClientDialogTrigger } from "@/components/clients/client-dialog-trigger";
import { ClientsSearch } from "@/components/clients/clients-search";
import { ClientsTable } from "@/components/clients/clients-table";
import { auth } from "@/lib/auth";
import { clientSearchSchema } from "@/lib/clients";
import { listClients } from "@/lib/clients-repo";

export const metadata = { title: "Clients — PayTrail" };

export default async function ClientsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	const params = await searchParams;
	const q = clientSearchSchema.parse(params.q);
	const clients = await listClients(session.user.id, q);

	return (
		<Stack
			component="main"
			spacing={2}
			sx={{ p: { xs: 2, sm: 4 }, maxWidth: 960, mx: "auto" }}
		>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				spacing={2}
				sx={{
					mb: 3,
					alignItems: { xs: "flex-start", sm: "center" },
					justifyContent: "space-between",
				}}
			>
				<Typography component="h1" variant="h4">
					Clients
				</Typography>
				<Stack direction="row" spacing={1}>
					<Button href="/dashboard" variant="text">
						Dashboard
					</Button>
					<ClientDialogTrigger />
					<SignOutButton />
				</Stack>
			</Stack>
			<Stack spacing={2}>
				<ClientsSearch />
				<ClientsTable
					clients={clients.map((client) => ({
						id: client.id,
						name: client.name,
						email: client.email,
						currencyCode: client.currencyCode,
						_projectCount: client._count.projects,
					}))}
				/>
			</Stack>
		</Stack>
	);
}
