import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { InvoiceListRow } from "@/components/invoices/invoices-list";
import { InvoicesList } from "@/components/invoices/invoices-list";
import { auth } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices-repo";

export const metadata = { title: "Invoices — PayTrail" };

export default async function InvoicesPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	const invoices = await listInvoices(session.user.id);
	const rows: InvoiceListRow[] = invoices.map((invoice) => ({
		id: invoice.id,
		invoiceNumber: invoice.invoiceNumber,
		clientName: invoice.client.name,
		status: invoice.derivedStatus,
		issueDate: invoice.issueDate.toISOString(),
		dueDate: invoice.dueDate.toISOString(),
		totalMinor: invoice.totals.totalMinor,
		currencyCode: invoice.currencyCode,
	}));

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
					Invoices
				</Typography>
				<Stack direction="row" spacing={1}>
					<Button href="/dashboard" variant="text">
						Dashboard
					</Button>
					<Button href="/invoices/new" variant="contained">
						New invoice
					</Button>
					<SignOutButton />
				</Stack>
			</Stack>
			<InvoicesList invoices={rows} />
		</Stack>
	);
}
