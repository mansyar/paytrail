"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { CreateInvoiceInput } from "@/lib/invoice-schemas";
import { createInvoiceInputSchema } from "@/lib/invoice-schemas";
import { computeInvoiceTotals } from "@/lib/invoice-totals";
import {
	createInvoiceAction,
	markPaidInvoiceAction,
	sendInvoiceAction,
	updateInvoiceAction,
} from "@/lib/invoices-actions";
import { formatMoney } from "@/lib/money-format";
import { minorToAmountString, parseAmountToMinor } from "@/lib/money-input";
import type { RateSuggestion } from "@/lib/rate-suggestions";
import { suggestRateForDescription } from "@/lib/rate-suggestions";
import type { CurrencyCode, PaymentTerms } from "@/lib/schemas";
import { InvoicePreview } from "./invoice-preview";
import { InvoiceStatusChip } from "./invoice-status-chip";

export interface BuilderClient {
	id: string;
	name: string;
	currencyCode: string;
}

export interface BuilderProject {
	id: string;
	clientId: string;
	name: string;
}

export interface BuilderRule {
	id: string;
	keyword: string;
	rateMinor: number;
	sortOrder: number;
}

export interface BuilderProfile {
	businessName: string;
	addressLines: string[];
	contactEmail: string | null;
	taxId: string | null;
	logo: string | null;
	currencyCode: string;
	defaultTaxRate: string;
	paymentTerms: PaymentTerms | null;
}

export interface BuilderInvoice {
	id: string;
	status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
	clientId: string;
	/** The invoice's stored currency — edit-mode form default (locked to the client). */
	currencyCode: CurrencyCode;
	projectId: string | null;
	invoiceNumber: string;
	issueDate: string;
	dueDate: string;
	taxRate: string;
	discountMinor: number;
	items: { description: string; amountMinor: number }[];
}

export interface InvoiceBuilderProps {
	clients: BuilderClient[];
	projects: BuilderProject[];
	rules: BuilderRule[];
	profile: BuilderProfile;
	nextInvoiceNumber: string;
	/** Present in edit mode (existing invoice); absent on /invoices/new. */
	invoice?: BuilderInvoice;
}

const emptyItem = { description: "", amount: "" };

/** Convert payment terms to a due date offset in days from today (UTC). */
function termsToDays(paymentTerms: PaymentTerms | null): number {
	switch (paymentTerms) {
		case "net_7":
			return 7;
		case "net_14":
			return 14;
		case "net_30":
			return 30;
		case "net_60":
			return 60;
		default:
			return 0;
	}
}

function todayUTC(): string {
	return new Date().toISOString().slice(0, 10);
}

function dueDateUTC(paymentTerms: PaymentTerms | null): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + termsToDays(paymentTerms));
	return date.toISOString().slice(0, 10);
}

export function InvoiceBuilder({
	clients,
	projects,
	rules,
	profile,
	nextInvoiceNumber,
	invoice,
}: InvoiceBuilderProps) {
	const router = useRouter();
	const mode = invoice ? "edit" : "create";
	// SENT/PAID (and derived OVERDUE) invoices open the same builder read-only.
	const readonly = Boolean(invoice && invoice.status !== "DRAFT");
	const [formError, setFormError] = useState<string | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
	/** Whether the current submit should also send the invoice after saving. */
	const sendAfterSave = useRef(false);
	/** Last rate the engine auto-applied per row (keyed by stable field id). */
	const [autoRates, setAutoRates] = useState<
		Record<string, RateSuggestion | undefined>
	>({});

	const defaults: CreateInvoiceInput = invoice
		? {
				clientId: invoice.clientId,
				projectId: invoice.projectId ?? "",
				invoiceNumber: invoice.invoiceNumber,
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				currencyCode: invoice.currencyCode,
				taxRate: invoice.taxRate,
				discount: minorToAmountString(invoice.discountMinor),
				items: invoice.items.map((item) => ({
					description: item.description,
					amount: minorToAmountString(item.amountMinor),
				})),
			}
		: {
				clientId: "",
				projectId: "",
				invoiceNumber: nextInvoiceNumber,
				issueDate: todayUTC(),
				dueDate: dueDateUTC(profile.paymentTerms),
				// profile.currencyCode is a plain string column; CURRENCIES values
				// are the only ones ever written (schemas.ts), so the cast is safe.
				currencyCode:
					profile.currencyCode as CreateInvoiceInput["currencyCode"],
				taxRate: profile.defaultTaxRate,
				discount: "0",
				items: [{ ...emptyItem }],
			};

	const form = useForm<CreateInvoiceInput>({
		resolver: zodResolver(createInvoiceInputSchema),
		defaultValues: defaults,
	});
	const {
		register,
		handleSubmit,
		control,
		setValue,
		setError,
		formState: { errors, isSubmitting },
	} = form;
	const { fields, append, remove, move } = useFieldArray({
		control,
		name: "items",
	});

	const watched = useWatch({ control });
	const selectedClient = clients.find(
		(client) => client.id === (watched.clientId ?? ""),
	);
	// Currency is locked to the client (spec); profile home currency is the
	// fallback until one is chosen.
	const currencyCode = selectedClient?.currencyCode ?? profile.currencyCode;
	const clientProjects = projects.filter(
		(project) => project.clientId === (watched.clientId ?? ""),
	);

	const totals = useMemo(() => {
		const items = (watched.items ?? []).map((item) => ({
			amountMinor: parseAmountToMinor(item?.amount ?? "") ?? 0,
		}));
		return computeInvoiceTotals({
			items,
			taxRate: Number(watched.taxRate ?? 0),
			discountMinor: parseAmountToMinor(watched.discount ?? "0") ?? 0,
		});
	}, [watched.items, watched.taxRate, watched.discount]);

	const previewItems = (watched.items ?? []).map((item) => ({
		description: item?.description ?? "",
		amountMinor: parseAmountToMinor(item?.amount ?? "") ?? 0,
	}));

	const handleDescriptionBlur = (index: number) => {
		const field = fields[index];
		const description = watched.items?.[index]?.description ?? "";
		const suggestion = suggestRateForDescription(description, rules);
		if (!suggestion) return;
		const current = watched.items?.[index]?.amount ?? "";
		const prev = autoRates[field.id];
		// Only auto-fill when the row is untouched or still shows the
		// previously suggested rate — never overwrite a manual override.
		if (
			current.trim() === "" ||
			(prev && current === minorToAmountString(prev.rateMinor))
		) {
			setValue(
				`items.${index}.amount`,
				minorToAmountString(suggestion.rateMinor),
				{ shouldValidate: true },
			);
		}
		setAutoRates((map) => ({ ...map, [field.id]: suggestion }));
	};

	const matchedCue = (index: number): RateSuggestion | null => {
		const field = fields[index];
		const auto = autoRates[field.id];
		if (!auto) return null;
		const amount = parseAmountToMinor(watched.items?.[index]?.amount ?? "");
		return amount === auto.rateMinor ? auto : null;
	};

	const submitInvoice = async (values: CreateInvoiceInput) => {
		setFormError(null);
		const shouldSend = sendAfterSave.current;
		sendAfterSave.current = false;

		if (mode === "edit" && invoice) {
			const result = await updateInvoiceAction(invoice.id, {
				issueDate: values.issueDate,
				dueDate: values.dueDate,
				currencyCode: currencyCode as CreateInvoiceInput["currencyCode"],
				taxRate: values.taxRate,
				discount: values.discount,
				items: values.items,
			});
			if (!result.ok) {
				setFormError(
					result.message ??
						"Could not save the invoice. Please check the form.",
				);
				return;
			}
			if (shouldSend) {
				const sent = await sendInvoiceAction(invoice.id);
				if (!sent.ok) {
					setFormError(
						sent.message ?? "Could not send the invoice. Please try again.",
					);
					router.refresh();
					return;
				}
			}
			router.push(`/invoices/${invoice.id}`);
			router.refresh();
			return;
		}

		const result = await createInvoiceAction({
			...values,
			currencyCode: currencyCode as CreateInvoiceInput["currencyCode"],
		});
		if (!result.ok) {
			if (result.reason === "NUMBER_TAKEN") {
				setError("invoiceNumber", {
					message: result.message ?? "That invoice number is already in use.",
				});
				return;
			}
			setFormError(
				result.message ?? "Could not save the invoice. Please check the form.",
			);
			return;
		}
		if (shouldSend) {
			const sent = await sendInvoiceAction(result.invoice.id);
			if (!sent.ok) {
				setFormError(
					sent.message ??
						"Invoice saved, but sending failed. Try again from the list.",
				);
			}
			router.push(`/invoices/${result.invoice.id}`);
			router.refresh();
			return;
		}
		router.push(`/invoices/${result.invoice.id}`);
	};

	// Catches thrown transport/server failures the typed results don't cover.
	const onSubmit = async (values: CreateInvoiceInput) => {
		try {
			await submitInvoice(values);
		} catch {
			setFormError("Something went wrong. Please try again.");
		}
	};

	const openSendConfirm = () => {
		setSendConfirmOpen(true);
	};

	const confirmSend = () => {
		setSendConfirmOpen(false);
		sendAfterSave.current = true;
		// Run validation + submit with the send flag set.
		void handleSubmit(onSubmit)();
	};

	const markPaid = async () => {
		if (!invoice) return;
		try {
			const result = await markPaidInvoiceAction(invoice.id);
			if (!result.ok) {
				setFormError(result.message ?? "Could not mark the invoice as paid.");
				return;
			}
			router.refresh();
		} catch {
			setFormError("Something went wrong. Please try again.");
		}
	};

	return (
		<Stack
			direction={{ xs: "column", md: "row" }}
			spacing={3}
			sx={{ alignItems: "flex-start" }}
			useFlexGap
		>
			<Stack
				component="form"
				noValidate
				onSubmit={handleSubmit(onSubmit)}
				spacing={3}
				sx={{ flex: 1, minWidth: 0, width: "100%" }}
			>
				{formError && (
					<MuiAlert severity="error" variant="outlined">
						{formError}
					</MuiAlert>
				)}

				<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
					<Stack
						direction="row"
						spacing={1}
						sx={{
							mb: 2,
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<Typography component="h2" variant="h6">
							Invoice details
						</Typography>
						{invoice && <InvoiceStatusChip status={invoice.status} />}
					</Stack>
					<Stack spacing={2}>
						<TextField
							disabled={readonly}
							error={Boolean(errors.clientId)}
							fullWidth
							helperText={
								errors.clientId?.message ?? "Currency follows the client"
							}
							label="Client"
							select
							{...register("clientId", {
								onChange: () => setValue("projectId", ""),
							})}
							value={watched.clientId ?? ""}
						>
							{clients.map((client) => (
								<MenuItem key={client.id} value={client.id}>
									{client.name} ({client.currencyCode})
								</MenuItem>
							))}
						</TextField>
						{clientProjects.length > 0 && (
							<TextField
								disabled={readonly}
								fullWidth
								label="Project (optional)"
								select
								{...register("projectId")}
								value={watched.projectId ?? ""}
							>
								{clientProjects.map((project) => (
									<MenuItem key={project.id} value={project.id}>
										{project.name}
									</MenuItem>
								))}
							</TextField>
						)}
						<TextField
							disabled={readonly}
							fullWidth
							label="Issue date"
							slotProps={{ inputLabel: { shrink: true } }}
							type="date"
							{...register("issueDate")}
							error={Boolean(errors.issueDate)}
							helperText={errors.issueDate?.message}
						/>
						<TextField
							disabled={readonly}
							fullWidth
							label="Due date"
							slotProps={{ inputLabel: { shrink: true } }}
							type="date"
							{...register("dueDate")}
							error={Boolean(errors.dueDate)}
							helperText={errors.dueDate?.message}
						/>
						<TextField
							disabled={readonly || mode === "edit"}
							fullWidth
							label={`Invoice number (next: ${nextInvoiceNumber})`}
							helperText={
								errors.invoiceNumber?.message ??
								(mode === "edit"
									? "Fixed when the invoice was created"
									: "Leave blank to use the next automatic number")
							}
							error={Boolean(errors.invoiceNumber)}
							{...register("invoiceNumber")}
						/>
						<TextField
							fullWidth
							label="Currency"
							helperText="Locked to the selected client"
							slotProps={{ input: { readOnly: true } }}
							value={currencyCode}
						/>
					</Stack>
				</Paper>

				<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
					<Stack
						direction={{ xs: "column", sm: "row" }}
						spacing={1}
						sx={{
							mb: 2,
							alignItems: { xs: "flex-start", sm: "center" },
							justifyContent: "space-between",
						}}
					>
						<Typography component="h2" variant="h6">
							Line items
						</Typography>
						{!readonly && (
							<Button
								onClick={() => append({ ...emptyItem })}
								size="small"
								startIcon={<AddIcon />}
								sx={{ minHeight: 44 }}
							>
								Add item
							</Button>
						)}
					</Stack>
					<Stack spacing={2}>
						{fields.map((field, index) => {
							const cue = matchedCue(index);
							return (
								<Stack key={field.id} spacing={1}>
									<Stack
										direction="row"
										spacing={1}
										sx={{ alignItems: "center" }}
										useFlexGap
									>
										<TextField
											disabled={readonly}
											fullWidth
											label={`Item ${index + 1} description`}
											size="small"
											{...register(`items.${index}.description` as const)}
											error={Boolean(errors.items?.[index]?.description)}
											helperText={errors.items?.[index]?.description?.message}
											onBlur={() => handleDescriptionBlur(index)}
										/>
										<TextField
											disabled={readonly}
											label="Amount"
											size="small"
											slotProps={{
												htmlInput: {
													inputMode: "decimal",
													placeholder: "0.00",
												},
											}}
											sx={{ width: 130, flexShrink: 0 }}
											{...register(`items.${index}.amount` as const)}
											error={Boolean(errors.items?.[index]?.amount)}
											helperText={errors.items?.[index]?.amount?.message}
										/>
										{!readonly && (
											<>
												<IconButton
													aria-label={`Move item ${index + 1} up`}
													disabled={index === 0}
													onClick={() => move(index, index - 1)}
													size="small"
													sx={{ minWidth: 44, minHeight: 44 }}
												>
													<ArrowUpwardIcon fontSize="small" />
												</IconButton>
												<IconButton
													aria-label={`Move item ${index + 1} down`}
													disabled={index === fields.length - 1}
													onClick={() => move(index, index + 1)}
													size="small"
													sx={{ minWidth: 44, minHeight: 44 }}
												>
													<ArrowDownwardIcon fontSize="small" />
												</IconButton>
												<IconButton
													aria-label={`Remove item ${index + 1}`}
													disabled={fields.length === 1}
													onClick={() => remove(index)}
													size="small"
													sx={{ minWidth: 44, minHeight: 44 }}
												>
													<DeleteIcon fontSize="small" />
												</IconButton>
											</>
										)}
									</Stack>
									{cue && (
										<Chip
											color="primary"
											label={`Rate rule: ${cue.matchedKeyword}`}
											size="small"
											variant="outlined"
											sx={{ alignSelf: "flex-start" }}
										/>
									)}
								</Stack>
							);
						})}
					</Stack>
				</Paper>

				<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
					<Typography component="h2" gutterBottom variant="h6">
						Adjustments
					</Typography>
					<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
						<TextField
							disabled={readonly}
							fullWidth
							label="Tax rate (%)"
							slotProps={{
								htmlInput: { inputMode: "decimal", placeholder: "0.00" },
							}}
							{...register("taxRate")}
							error={Boolean(errors.taxRate)}
							helperText={
								errors.taxRate?.message ?? "Defaults from your profile"
							}
						/>
						<TextField
							disabled={readonly}
							fullWidth
							label="Discount"
							slotProps={{
								htmlInput: { inputMode: "decimal", placeholder: "0.00" },
							}}
							{...register("discount")}
							error={Boolean(errors.discount)}
							helperText={
								errors.discount?.message ?? "Flat amount, applied before tax"
							}
						/>
					</Stack>
				</Paper>

				<Paper
					sx={{
						position: "sticky",
						bottom: 0,
						zIndex: 2,
						p: 2,
						bgcolor: "background.paper",
						border: 1,
						borderColor: "divider",
						borderRadius: 2,
					}}
				>
					<Stack
						direction={{ xs: "column", sm: "row" }}
						spacing={2}
						sx={{
							alignItems: { xs: "stretch", sm: "center" },
							justifyContent: "space-between",
						}}
					>
						<Stack spacing={0.5} sx={{ minWidth: 220 }}>
							<Stack direction="row" sx={{ justifyContent: "space-between" }}>
								<Typography color="text.secondary" variant="body2">
									Subtotal
								</Typography>
								<Typography variant="body2">
									{formatMoney(totals.subtotalMinor, currencyCode)}
								</Typography>
							</Stack>
							{totals.discountAppliedMinor > 0 && (
								<Stack direction="row" sx={{ justifyContent: "space-between" }}>
									<Typography color="text.secondary" variant="body2">
										Discount
									</Typography>
									<Typography variant="body2">
										−{formatMoney(totals.discountAppliedMinor, currencyCode)}
									</Typography>
								</Stack>
							)}
							<Stack direction="row" sx={{ justifyContent: "space-between" }}>
								<Typography color="text.secondary" variant="body2">
									Tax ({Number(watched.taxRate ?? 0)}%)
								</Typography>
								<Typography variant="body2">
									{formatMoney(totals.taxMinor, currencyCode)}
								</Typography>
							</Stack>
							<Divider />
							<Stack direction="row" sx={{ justifyContent: "space-between" }}>
								<Typography variant="subtitle1">Total</Typography>
								<Typography variant="subtitle1">
									{formatMoney(totals.totalMinor, currencyCode)}
								</Typography>
							</Stack>
						</Stack>
						{readonly ? (
							invoice?.status === "SENT" || invoice?.status === "OVERDUE" ? (
								<Button
									color="success"
									disabled={isSubmitting}
									onClick={markPaid}
									size="large"
									sx={{ minHeight: 48 }}
									variant="contained"
								>
									Mark as paid
								</Button>
							) : null
						) : (
							<Stack direction="row" spacing={1} useFlexGap>
								<Button
									disabled={isSubmitting}
									size="large"
									sx={{ minHeight: 48 }}
									type="submit"
									variant="outlined"
								>
									Save draft
								</Button>
								<Button
									color="success"
									disabled={isSubmitting}
									onClick={openSendConfirm}
									size="large"
									sx={{ minHeight: 48 }}
									variant="contained"
								>
									Send
								</Button>
							</Stack>
						)}
					</Stack>
				</Paper>
			</Stack>

			<Stack
				spacing={1}
				sx={{ width: { xs: "100%", md: 400 }, flexShrink: 0 }}
				useFlexGap
			>
				<Button
					onClick={() => setPreviewOpen((open) => !open)}
					sx={{ display: { md: "none" }, minHeight: 44 }}
					variant="outlined"
				>
					{previewOpen ? "Hide preview" : "Show preview"}
				</Button>
				<Collapse in={previewOpen} sx={{ display: { md: "none" } }}>
					<InvoicePreview
						clientName={selectedClient?.name ?? "—"}
						currencyCode={currencyCode}
						// useWatch returns loosely-typed field values; these casts narrow
						// fields with known string shapes.
						dueDate={(watched.dueDate as string | undefined) ?? ""}
						invoiceNumber={
							(watched.invoiceNumber as string | undefined) || nextInvoiceNumber
						}
						issueDate={(watched.issueDate as string | undefined) ?? ""}
						items={previewItems}
						profile={profile}
						totals={totals}
					/>
				</Collapse>
				<Box sx={{ display: { xs: "none", md: "block" } }}>
					<InvoicePreview
						clientName={selectedClient?.name ?? "—"}
						currencyCode={currencyCode}
						// useWatch returns loosely-typed field values; these casts narrow
						// fields with known string shapes.
						dueDate={(watched.dueDate as string | undefined) ?? ""}
						invoiceNumber={
							(watched.invoiceNumber as string | undefined) || nextInvoiceNumber
						}
						issueDate={(watched.issueDate as string | undefined) ?? ""}
						items={previewItems}
						profile={profile}
						totals={totals}
					/>
				</Box>
			</Stack>

			<Dialog
				aria-labelledby="send-confirm-title"
				onClose={() => setSendConfirmOpen(false)}
				open={sendConfirmOpen}
			>
				<DialogTitle id="send-confirm-title">Send this invoice?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						The invoice will be marked as sent and locked — it can no longer be
						edited or deleted. This is the number your client will see.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setSendConfirmOpen(false)}>Cancel</Button>
					<Button
						color="success"
						disabled={isSubmitting}
						onClick={confirmSend}
						variant="contained"
					>
						Send invoice
					</Button>
				</DialogActions>
			</Dialog>
		</Stack>
	);
}
