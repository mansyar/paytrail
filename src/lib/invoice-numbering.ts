import { prisma } from "./db";

/**
 * Invoice numbering: per-user yearly sequence INV-<year>-0001.
 *
 * The counter row tracks the highest auto-issued sequence per (user, year).
 * Manual overrides are allowed; the auto counter always advances past any
 * taken number (collision-safe skip). Known limitation (same class as
 * rate-rules ordering): two concurrent creates for one user can race on the
 * counter; the invoice table's UNIQUE(userId, invoiceNumber) remains the
 * hard guarantee and creation retries surface it to the caller.
 */

const INVOICE_NUMBER_PATTERN = /^INV-\d{4}-\d{4,}$/;

/** Thrown when a manual number collides with an existing invoice. */
export class InvoiceNumberTakenError extends Error {
	constructor(invoiceNumber: string) {
		super(`Invoice number ${invoiceNumber} is already in use`);
		this.name = "InvoiceNumberTakenError";
	}
}

/** Thrown when a manual number is malformed or mismatches the issue year. */
export class InvoiceNumberInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvoiceNumberInvalidError";
	}
}

export function formatInvoiceNumber(year: number, sequence: number): string {
	return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Issue the next free auto number for the user's given year. */
export async function nextInvoiceNumber(
	userId: string,
	year: number,
): Promise<string> {
	return prisma.$transaction(async (tx) => {
		const counter = await tx.invoiceNumberCounter.upsert({
			where: { userId_year: { userId, year } },
			create: { userId, year, lastNumber: 1 },
			update: { lastNumber: { increment: 1 } },
		});

		let sequence = counter.lastNumber;
		// Skip numbers already taken (e.g. by earlier manual overrides).
		while (
			await tx.invoice.findFirst({
				where: { userId, invoiceNumber: formatInvoiceNumber(year, sequence) },
				select: { id: true },
			})
		) {
			sequence += 1;
		}

		if (sequence !== counter.lastNumber) {
			await tx.invoiceNumberCounter.update({
				where: { userId_year: { userId, year } },
				data: { lastNumber: sequence },
			});
		}

		return formatInvoiceNumber(year, sequence);
	});
}

/**
 * Prefill preview for the builder: the number the next auto issuance
 * would use, WITHOUT consuming or advancing the counter. Read-only.
 */
export async function previewNextInvoiceNumber(
	userId: string,
	year: number,
): Promise<string> {
	const counter = await prisma.invoiceNumberCounter.findUnique({
		where: { userId_year: { userId, year } },
		select: { lastNumber: true },
	});
	let sequence = (counter?.lastNumber ?? 0) + 1;
	while (
		await prisma.invoice.findFirst({
			where: { userId, invoiceNumber: formatInvoiceNumber(year, sequence) },
			select: { id: true },
		})
	) {
		sequence += 1;
	}
	return formatInvoiceNumber(year, sequence);
}

/**
 * Resolve the number for a new invoice: the manual override when provided,
 * otherwise the next auto number. A manual number must be free; the counter
 * is advanced past it so later auto numbers never collide with it.
 */
export async function resolveInvoiceNumber({
	userId,
	year,
	manualNumber,
}: {
	userId: string;
	year: number;
	manualNumber?: string;
}): Promise<{ number: string }> {
	if (manualNumber === undefined || manualNumber === "") {
		return { number: await nextInvoiceNumber(userId, year) };
	}

	if (!INVOICE_NUMBER_PATTERN.test(manualNumber)) {
		throw new InvoiceNumberInvalidError(
			`Invalid invoice number format: expected INV-<year>-<sequence> (e.g. INV-2026-0001), got "${manualNumber}"`,
		);
	}

	const manualYear = Number(manualNumber.split("-")[1]);
	if (manualYear !== year) {
		throw new InvoiceNumberInvalidError(
			`Invoice number year ${manualYear} does not match the issue year ${year}`,
		);
	}

	const taken = await prisma.invoice.findFirst({
		where: { userId, invoiceNumber: manualNumber },
		select: { id: true },
	});
	if (taken) {
		throw new InvoiceNumberTakenError(manualNumber);
	}

	const sequence = Number(manualNumber.split("-")[2]);
	await prisma.$transaction(async (tx) => {
		const counter = await tx.invoiceNumberCounter.upsert({
			where: { userId_year: { userId, year } },
			create: { userId, year, lastNumber: sequence },
			update: {},
		});
		if (counter.lastNumber < sequence) {
			await tx.invoiceNumberCounter.update({
				where: { userId_year: { userId, year } },
				data: { lastNumber: sequence },
			});
		}
	});

	return { number: manualNumber };
}
