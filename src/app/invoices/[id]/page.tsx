import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { invoiceIdSchema } from "@/lib/invoice-schemas";
import { getInvoice } from "@/lib/invoices-repo";
import { isOnboardingComplete } from "@/lib/onboarding";
import type { CurrencyCode, PaymentTerms } from "@/lib/schemas";

export const metadata = { title: "Invoice — PayTrail" };

export default async function InvoicePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	// The id comes from the URL — validate before it reaches the data layer.
	const parsedId = invoiceIdSchema.safeParse(id);
	if (!parsedId.success) {
		notFound();
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	// Defense in depth: the proxy only checks cookie existence.
	if (!session) {
		redirect("/login");
	}

	if (!(await isOnboardingComplete(session.user.id))) {
		redirect("/onboarding");
	}

	const userId = session.user.id;

	const [invoice, clients, projects, rules, profile] = await Promise.all([
		getInvoice(userId, parsedId.data),
		prisma.client.findMany({
			where: { userId },
			orderBy: { name: "asc" },
			select: { id: true, name: true, currencyCode: true },
		}),
		prisma.project.findMany({
			where: { client: { userId } },
			orderBy: { name: "asc" },
			select: { id: true, clientId: true, name: true },
		}),
		prisma.rateRule.findMany({
			where: { userId },
			orderBy: { sortOrder: "asc" },
			select: { id: true, keyword: true, rateMinor: true, sortOrder: true },
		}),
		prisma.businessProfile.findUnique({ where: { userId } }),
	]);

	if (!invoice) {
		notFound();
	}
	if (!profile) {
		redirect("/onboarding");
	}

	return (
		<Stack
			component="main"
			spacing={2}
			sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1100, mx: "auto" }}
		>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				spacing={2}
				sx={{
					alignItems: { xs: "flex-start", sm: "center" },
					justifyContent: "space-between",
				}}
			>
				<Typography component="h1" variant="h4">
					{invoice.invoiceNumber}
				</Typography>
				<Button href="/invoices" variant="text">
					Back to invoices
				</Button>
			</Stack>

			<InvoiceBuilder
				clients={clients}
				invoice={{
					id: invoice.id,
					status: invoice.derivedStatus,
					clientId: invoice.clientId,
					// The schema validated currencyCode at creation; the Prisma column
					// is a plain string, so this cast only restores the union type.
					currencyCode: invoice.currencyCode as CurrencyCode,
					projectId: invoice.projectId,
					invoiceNumber: invoice.invoiceNumber,
					issueDate: invoice.issueDate.toISOString().slice(0, 10),
					dueDate: invoice.dueDate.toISOString().slice(0, 10),
					taxRate: invoice.taxRate.toFixed(2),
					discountMinor: invoice.discountMinor,
					items: invoice.items.map((item) => ({
						description: item.description,
						amountMinor: item.amountMinor,
					})),
				}}
				nextInvoiceNumber={invoice.invoiceNumber}
				profile={{
					businessName: profile.businessName,
					addressLines: [profile.addressLine1, profile.addressLine2].filter(
						(line): line is string => Boolean(line),
					),
					contactEmail: profile.contactEmail,
					taxId: profile.taxId,
					logo: profile.logo,
					currencyCode: profile.currency,
					defaultTaxRate: profile.defaultTaxRate.toFixed(2),
					// profile.paymentTerms is a nullable string column; PAYMENT_TERMS
					// values are the only ones written (schemas.ts), so the cast is safe.
					paymentTerms: profile.paymentTerms as PaymentTerms | null,
				}}
				projects={projects}
				rules={rules}
			/>
		</Stack>
	);
}
