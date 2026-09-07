"use client";

import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteClientAction } from "@/lib/clients-actions";
import { ClientDialog } from "./client-dialog";

export interface ClientPageActionsProps {
	client: {
		id: string;
		name: string;
		email: string | null;
		address: string | null;
		currencyCode: string;
		notes: string | null;
	};
}

export function ClientPageActions({ client }: ClientPageActionsProps) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const onDelete = async () => {
		setIsDeleting(true);
		setInvoiceCount(null);
		setError(null);
		try {
			const result = await deleteClientAction(client.id);
			if (result.ok) {
				router.push("/clients");
				return;
			}
			if (result.reason === "INVOICES_ATTACHED") {
				setInvoiceCount(result.invoiceCount ?? 0);
			} else {
				setError("This client no longer exists.");
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Stack spacing={1} sx={{ alignItems: { xs: "stretch", sm: "flex-end" } }}>
			<Stack direction="row" spacing={1}>
				<Button
					onClick={() => setEditOpen(true)}
					sx={{ minHeight: 44 }}
					variant="outlined"
				>
					Edit
				</Button>
				<Button
					color="error"
					disabled={isDeleting}
					onClick={onDelete}
					sx={{ minHeight: 44 }}
					variant="outlined"
				>
					Delete
				</Button>
			</Stack>
			{invoiceCount !== null ? (
				<MuiAlert severity="warning" variant="outlined">
					Can&apos;t delete — {invoiceCount} invoice
					{invoiceCount === 1 ? "" : "s"} attached. Cancel{" "}
					{invoiceCount === 1 ? "it" : "them"} first.
				</MuiAlert>
			) : null}
			{error ? (
				<MuiAlert severity="error" variant="outlined">
					{error}
				</MuiAlert>
			) : null}
			<ClientDialog
				client={client}
				onClose={() => setEditOpen(false)}
				open={editOpen}
			/>
		</Stack>
	);
}
