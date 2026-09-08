import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/fx/rate-service";
import { previewNextInvoiceNumber } from "@/lib/invoice-numbering";
import { isOnboardingComplete } from "@/lib/onboarding";
import type { PaymentTerms } from "@/lib/schemas";

export const metadata = { title: "New invoice — PayTrail" };

export default async function NewInvoicePage() {
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
	const year = new Date().getUTCFullYear();

	const [clients, projects, rules, profile, nextNumber] = await Promise.all([
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
		previewNextInvoiceNumber(userId, year),
	]);

	if (!profile) {
		redirect("/onboarding");
	}

	// Effective FX rates for the builder's rate field
	// (fx_multi_currency_20260908): one rate-service call per foreign client
	// currency (cache-backed), rounded to the 8 decimals the schema accepts.
	// Concurrent resolution: sequential getRate calls can stack 5s provider
	// timeouts serially on a cold cache.
	const foreignCurrencies = [
		...new Set(
			clients.map((c) => c.currencyCode).filter((c) => c !== profile.currency),
		),
	];
	const rates = await Promise.all(
		foreignCurrencies.map((c) => getRate(profile.currency, c)),
	);
	const fxRates: Record<string, string | null> = {};
	foreignCurrencies.forEach((currency, i) => {
		const rate = rates[i];
		fxRates[currency] = rate
			? (Math.round(rate.toNumber() * 1e8) / 1e8).toString()
			: null;
	});

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
					New invoice
				</Typography>
				<Button href="/invoices" variant="text">
					Back to invoices
				</Button>
			</Stack>

			{clients.length === 0 ? (
				<MuiAlert
					severity="info"
					variant="outlined"
					action={
						<Button component={Link} href="/clients" size="small">
							Add client
						</Button>
					}
				>
					You need at least one client before you can create an invoice.
				</MuiAlert>
			) : (
				<InvoiceBuilder
					clients={clients}
					fxRates={fxRates}
					nextInvoiceNumber={nextNumber}
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
			)}
		</Stack>
	);
}
