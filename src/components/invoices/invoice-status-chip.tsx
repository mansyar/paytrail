"use client";

import Chip from "@mui/material/Chip";

export type DisplayStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

const CONFIG: Record<
	DisplayStatus,
	{ label: string; color: "default" | "info" | "success" | "error" }
> = {
	DRAFT: { label: "Draft", color: "default" },
	SENT: { label: "Sent", color: "info" },
	PAID: { label: "Paid", color: "success" },
	OVERDUE: { label: "Overdue", color: "error" },
};

/** Status chip for a display status (OVERDUE is derived on read, never stored). */
export function InvoiceStatusChip({ status }: { status: DisplayStatus }) {
	const { label, color } = CONFIG[status];
	return (
		<Chip
			color={color}
			label={label}
			size="small"
			variant={status === "DRAFT" ? "outlined" : "filled"}
		/>
	);
}
