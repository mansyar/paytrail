import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoicePdfInput } from "@/lib/invoice-pdf-mapper";
import { invoiceIdSchema } from "@/lib/invoice-schemas";
import { getInvoice } from "@/lib/invoices-repo";

export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { id } = await context.params;
	// The id comes from the URL — validate before it reaches the data layer.
	const parsedId = invoiceIdSchema.safeParse(id);
	if (!parsedId.success) {
		return new Response("Invalid invoice id", { status: 400 });
	}

	const userId = session.user.id;
	// getInvoice scopes by userId — another user's invoice is a 404, not a 403.
	const invoice = await getInvoice(userId, parsedId.data);
	if (!invoice) {
		return new Response("Not found", { status: 404 });
	}

	const [profile, project] = await Promise.all([
		prisma.businessProfile.findUnique({ where: { userId } }),
		invoice.projectId
			? prisma.project.findFirst({
					where: { id: invoice.projectId, client: { userId } },
					select: { name: true },
				})
			: Promise.resolve(null),
	]);

	const input = buildInvoicePdfInput(
		{ invoice, items: invoice.items, projectName: project?.name ?? null },
		profile,
	);
	const pdf = await renderInvoicePdf(input);

	const safeName = input.invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "_");
	return new Response(new Blob([pdf]), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${safeName}.pdf"`,
			"Cache-Control": "no-store",
		},
	});
}
