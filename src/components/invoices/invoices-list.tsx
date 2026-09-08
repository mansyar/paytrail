"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	deleteInvoiceAction,
	markPaidInvoiceAction,
	sendInvoiceAction,
} from "@/lib/invoices-actions";
import { formatFxRate, formatMoney } from "@/lib/money-format";
import type { DisplayStatus } from "./invoice-status-chip";
import { InvoiceStatusChip } from "./invoice-status-chip";

export interface InvoiceListRow {
	id: string;
	invoiceNumber: string;
	clientName: string;
	status: DisplayStatus;
	issueDate: string;
	dueDate: string;
	totalMinor: number;
	currencyCode: string;
	/** Home-currency equivalent display (fx_multi_currency_20260908). */
	homeCurrencyCode?: string;
	/** 1 invoice-currency unit in home-currency minor units, when a snapshot exists. */
	homeEquivalentMinor?: number | null;
	fxRate?: string | null;
}

type StatusFilter = "ALL" | DisplayStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
	{ value: "ALL", label: "All" },
	{ value: "DRAFT", label: "Draft" },
	{ value: "SENT", label: "Sent" },
	{ value: "PAID", label: "Paid" },
	{ value: "OVERDUE", label: "Overdue" },
];

/**
 * Home-currency equivalent line, shown only when the invoice is in a
 * non-home currency AND an FX snapshot exists (fx_multi_currency_20260908).
 */
function HomeEquivalentLine({ invoice }: { invoice: InvoiceListRow }) {
	if (
		invoice.homeEquivalentMinor == null ||
		!invoice.homeCurrencyCode ||
		!invoice.fxRate
	) {
		return null;
	}
	return (
		<Typography
			color="text.secondary"
			variant="caption"
		>{`≈ ${formatMoney(invoice.homeEquivalentMinor, invoice.homeCurrencyCode)} @ ${formatFxRate(invoice.fxRate)} ${invoice.homeCurrencyCode}`}</Typography>
	);
}

type ConfirmState = { kind: "send" | "delete"; invoice: InvoiceListRow } | null;
type Feedback = { severity: "success" | "error"; message: string } | null;

function actionErrorMessage(reason: string, message?: string): string {
	switch (reason) {
		case "NUMBER_TAKEN":
			return "That invoice number is already in use.";
		case "INVALID_TRANSITION":
			return message ?? "That action is no longer allowed for this invoice.";
		case "NOT_FOUND":
			return "Invoice not found — it may have been deleted.";
		default:
			return message ?? "Something went wrong. Please try again.";
	}
}

function formatDate(isoDate: string): string {
	return new Date(isoDate).toLocaleDateString("en-US", {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function InvoicesList({ invoices }: { invoices: InvoiceListRow[] }) {
	const router = useRouter();
	const [filter, setFilter] = useState<StatusFilter>("ALL");
	const [search, setSearch] = useState("");
	const [confirm, setConfirm] = useState<ConfirmState>(null);
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<Feedback>(null);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		return invoices.filter((invoice) => {
			if (filter !== "ALL" && invoice.status !== filter) return false;
			if (
				query &&
				!invoice.clientName.toLowerCase().includes(query) &&
				!invoice.invoiceNumber.toLowerCase().includes(query)
			) {
				return false;
			}
			return true;
		});
	}, [invoices, filter, search]);

	async function runAction(
		action: () => Promise<{ ok: boolean; reason?: string; message?: string }>,
		successMessage: string,
	) {
		setPending(true);
		try {
			const result = await action();
			if (result.ok) {
				setFeedback({ severity: "success", message: successMessage });
				router.refresh();
			} else {
				setFeedback({
					severity: "error",
					message: actionErrorMessage(result.reason ?? "", result.message),
				});
			}
		} catch {
			// Transport/server failures the typed results don't cover.
			setFeedback({
				severity: "error",
				message: "Something went wrong. Please try again.",
			});
		} finally {
			setPending(false);
			setConfirm(null);
		}
	}

	function handleSend(invoice: InvoiceListRow) {
		return runAction(
			() => sendInvoiceAction(invoice.id),
			`${invoice.invoiceNumber} sent`,
		);
	}

	function handleMarkPaid(invoice: InvoiceListRow) {
		return runAction(
			() => markPaidInvoiceAction(invoice.id),
			`${invoice.invoiceNumber} marked paid`,
		);
	}

	function handleDelete(invoice: InvoiceListRow) {
		return runAction(
			() => deleteInvoiceAction(invoice.id),
			`${invoice.invoiceNumber} deleted`,
		);
	}

	if (invoices.length === 0) {
		return (
			<Stack
				role="region"
				spacing={2}
				sx={{
					alignItems: "center",
					border: 1,
					borderColor: "divider",
					borderRadius: 2,
					p: 6,
				}}
			>
				<Typography color="text.secondary" variant="body1">
					No invoices yet. Create your first invoice to start getting paid.
				</Typography>
				<Button component={NextLink} href="/invoices/new" variant="contained">
					New invoice
				</Button>
			</Stack>
		);
	}

	const rowActions = (invoice: InvoiceListRow) => {
		const canMarkPaid =
			invoice.status === "SENT" || invoice.status === "OVERDUE";
		return (
			<Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
				{invoice.status === "DRAFT" && (
					<Button
						component={NextLink}
						href={`/invoices/${invoice.id}`}
						size="small"
						sx={{ minHeight: 44 }}
					>
						Edit
					</Button>
				)}
				{invoice.status === "DRAFT" && (
					<Button
						disabled={pending}
						onClick={() => setConfirm({ kind: "send", invoice })}
						size="small"
						sx={{ minHeight: 44 }}
					>
						Send
					</Button>
				)}
				{canMarkPaid && (
					<Button
						disabled={pending}
						onClick={() => handleMarkPaid(invoice)}
						size="small"
						sx={{ minHeight: 44 }}
					>
						Mark paid
					</Button>
				)}
				{invoice.status === "DRAFT" && (
					<Button
						color="error"
						disabled={pending}
						onClick={() => setConfirm({ kind: "delete", invoice })}
						size="small"
						sx={{ minHeight: 44 }}
					>
						Delete
					</Button>
				)}
			</Stack>
		);
	};

	return (
		<Stack spacing={2}>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				spacing={2}
				sx={{
					alignItems: { xs: "stretch", sm: "center" },
					justifyContent: "space-between",
				}}
			>
				<ToggleButtonGroup
					exclusive
					onChange={(_, value: StatusFilter | null) => {
						if (value) setFilter(value);
					}}
					size="small"
					value={filter}
				>
					{FILTERS.map(({ value, label }) => (
						<ToggleButton key={value} sx={{ minHeight: 44 }} value={value}>
							{label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
				<TextField
					autoComplete="off"
					label="Search client or number"
					onChange={(event) => setSearch(event.target.value)}
					size="small"
					slotProps={{ htmlInput: { type: "search" } }}
					sx={{ maxWidth: { sm: 320 } }}
					value={search}
				/>
			</Stack>

			{filtered.length === 0 ? (
				<Stack
					role="region"
					spacing={2}
					sx={{
						alignItems: "center",
						border: 1,
						borderColor: "divider",
						borderRadius: 2,
						p: 6,
					}}
				>
					<Typography color="text.secondary" variant="body1">
						No invoices match your filters.
					</Typography>
					<Button
						onClick={() => {
							setFilter("ALL");
							setSearch("");
						}}
						variant="text"
					>
						Clear filters
					</Button>
				</Stack>
			) : (
				<>
					{/* Desktop: table */}
					<Box sx={{ display: { xs: "none", md: "block" } }}>
						<TableContainer>
							<Table size="medium">
								<TableHead>
									<TableRow>
										<TableCell>Number</TableCell>
										<TableCell>Client</TableCell>
										<TableCell>Due date</TableCell>
										<TableCell align="right">Total</TableCell>
										<TableCell>Status</TableCell>
										<TableCell align="right">Actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{filtered.map((invoice) => (
										<TableRow hover key={invoice.id}>
											<TableCell>
												<Link
													component={NextLink}
													href={`/invoices/${invoice.id}`}
													underline="hover"
												>
													{invoice.invoiceNumber}
												</Link>
											</TableCell>
											<TableCell>{invoice.clientName}</TableCell>
											<TableCell>{formatDate(invoice.dueDate)}</TableCell>
											<TableCell align="right">
												{formatMoney(invoice.totalMinor, invoice.currencyCode)}
												<HomeEquivalentLine invoice={invoice} />
											</TableCell>
											<TableCell>
												<InvoiceStatusChip status={invoice.status} />
											</TableCell>
											<TableCell align="right">{rowActions(invoice)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					</Box>

					{/* Mobile: stacked cards */}
					<Stack spacing={2} sx={{ display: { xs: "flex", md: "none" } }}>
						{filtered.map((invoice) => (
							<Card key={invoice.id}>
								<CardContent>
									<Stack spacing={1}>
										<Stack
											direction="row"
											sx={{
												alignItems: "center",
												justifyContent: "space-between",
											}}
										>
											<Link
												component={NextLink}
												href={`/invoices/${invoice.id}`}
												underline="hover"
											>
												{invoice.invoiceNumber}
											</Link>
											<InvoiceStatusChip status={invoice.status} />
										</Stack>
										<Typography variant="body1">
											{invoice.clientName}
										</Typography>
										<Stack
											direction="row"
											sx={{
												alignItems: "center",
												justifyContent: "space-between",
											}}
										>
											<Typography color="text.secondary" variant="body2">
												Due {formatDate(invoice.dueDate)}
											</Typography>
											<Typography variant="subtitle1">
												{formatMoney(invoice.totalMinor, invoice.currencyCode)}
											</Typography>
										</Stack>
										<HomeEquivalentLine invoice={invoice} />
										<Divider />
										{rowActions(invoice)}
									</Stack>
								</CardContent>
							</Card>
						))}
					</Stack>
				</>
			)}

			<Dialog onClose={() => setConfirm(null)} open={confirm !== null}>
				<DialogTitle>
					{confirm?.kind === "send"
						? `Send ${confirm.invoice.invoiceNumber}?`
						: `Delete ${confirm?.invoice.invoiceNumber}?`}
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						{confirm?.kind === "send"
							? "Sending locks the invoice — it can no longer be edited or deleted, and it becomes visible as awaiting payment."
							: "This permanently removes the draft. This cannot be undone."}
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button disabled={pending} onClick={() => setConfirm(null)}>
						Cancel
					</Button>
					{confirm?.kind === "send" && (
						<Button
							disabled={pending}
							onClick={() => handleSend(confirm.invoice)}
							variant="contained"
						>
							Send invoice
						</Button>
					)}
					{confirm?.kind === "delete" && (
						<Button
							color="error"
							disabled={pending}
							onClick={() => handleDelete(confirm.invoice)}
							variant="contained"
						>
							Delete draft
						</Button>
					)}
				</DialogActions>
			</Dialog>

			<Snackbar
				autoHideDuration={6000}
				onClose={() => setFeedback(null)}
				open={feedback !== null}
			>
				<Alert
					onClose={() => setFeedback(null)}
					severity={feedback?.severity}
					variant="filled"
				>
					{feedback?.message}
				</Alert>
			</Snackbar>
		</Stack>
	);
}
