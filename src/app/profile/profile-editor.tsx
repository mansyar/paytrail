"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import {
	Alert,
	Avatar,
	Box,
	Button,
	Chip,
	Container,
	Divider,
	IconButton,
	InputAdornment,
	MenuItem,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
	type BusinessProfileInput,
	businessProfileSchema,
	CURRENCIES,
	PAYMENT_TERMS,
} from "@/lib/schemas";
import {
	addRateRuleAction,
	deleteRateRuleAction,
	reorderRateRulesAction,
	updateProfileAction,
	updateRateRuleAction,
} from "./actions";

const LOGO_MAX_BYTES = 500 * 1024;

const LOGO_MIME_RE = /^image\/(png|jpeg)$/;

type RuleRow = { id: string; keyword: string; rate: string };

const TERMS_LABELS: Record<(typeof PAYMENT_TERMS)[number], string> = {
	due_on_receipt: "Due on receipt",
	net_7: "Net 7",
	net_14: "Net 14",
	net_30: "Net 30",
	net_60: "Net 60",
};

export function ProfileEditor({
	initialProfile,
	initialRules,
}: {
	initialProfile: {
		businessName: string;
		addressLine1: string;
		addressLine2: string;
		city: string;
		postalCode: string;
		contactEmail: string;
		taxId: string;
		logo: string;
		currency: BusinessProfileInput["currency"];
		defaultTaxRate: string;
		paymentTerms: string;
	};
	initialRules: RuleRow[];
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [logoError, setLogoError] = useState<string | null>(null);
	const [profileStatus, setProfileStatus] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);
	const [rules, setRules] = useState<RuleRow[]>(initialRules);
	const [ruleError, setRuleError] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<BusinessProfileInput>({
		resolver: zodResolver(businessProfileSchema),
		defaultValues: initialProfile,
	});

	// Zod's input type makes the logo field unknown; at runtime it is a
	// validated data-URL string (or empty when not set yet).
	const logo = watch("logo") as string | undefined;

	const onLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!LOGO_MIME_RE.test(file.type)) {
			setLogoError("Logo must be a PNG or JPEG image.");
			return;
		}
		if (file.size > LOGO_MAX_BYTES) {
			setLogoError("Logo must be 500 KB or smaller.");
			return;
		}
		setLogoError(null);
		const reader = new FileReader();
		reader.onload = () => {
			setValue("logo", String(reader.result), { shouldValidate: true });
		};
		reader.readAsDataURL(file);
	};

	const onProfileSubmit = handleSubmit(async (values) => {
		setProfileStatus(null);
		const result = await updateProfileAction(values);
		if (result.ok) {
			setProfileStatus({
				severity: "success",
				message: "Profile saved.",
			});
			router.refresh();
		} else {
			setProfileStatus({ severity: "error", message: result.message });
		}
	});

	const handleAddRule = async () => {
		setRuleError(null);
		const result = await addRateRuleAction();
		if (!result.ok) {
			setRuleError(result.message);
			return;
		}
		setRules((rows) => [...rows, { id: result.id, keyword: "", rate: "" }]);
	};

	const handleRuleChange = (id: string, patch: Partial<RuleRow>) => {
		setRules((rows) =>
			rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
		);
	};

	const handleRuleBlur = async (row: RuleRow) => {
		setRuleError(null);
		const result = await updateRateRuleAction(row.id, {
			keyword: row.keyword,
			rate: row.rate,
		});
		if (!result.ok) setRuleError(result.message);
		else router.refresh();
	};

	const cancelDeleteRule = () => {
		if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
		setConfirmDeleteId(null);
	};

	const handleDeleteRule = async (id: string) => {
		if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
		setConfirmDeleteId(null);
		setRuleError(null);
		const result = await deleteRateRuleAction(id);
		if (!result.ok) {
			setRuleError(result.message);
			return;
		}
		setRules((rows) => rows.filter((row) => row.id !== id));
		router.refresh();
	};

	const handleMoveRule = async (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= rules.length) return;
		const next = [...rules];
		[next[index], next[target]] = [next[target], next[index]];
		setRules(next);
		setRuleError(null);
		const result = await reorderRateRulesAction(next.map((row) => row.id));
		if (!result.ok) setRuleError(result.message);
		else router.refresh();
	};

	return (
		<Container maxWidth="sm" sx={{ py: 4, px: { xs: 2 } }}>
			<Typography variant="h4" component="h1" gutterBottom>
				Business profile
			</Typography>

			<Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }} component="section">
				<Typography variant="h6" gutterBottom>
					Identity &amp; defaults
				</Typography>
				<Box component="form" onSubmit={onProfileSubmit} noValidate>
					<Stack spacing={2}>
						<TextField
							label="Business name"
							required
							fullWidth
							error={Boolean(errors.businessName)}
							helperText={errors.businessName?.message}
							{...register("businessName")}
						/>
						<TextField
							label="Address line 1"
							fullWidth
							{...register("addressLine1")}
						/>
						<TextField
							label="Address line 2"
							fullWidth
							{...register("addressLine2")}
						/>
						<Stack direction="row" spacing={2}>
							<TextField label="City" fullWidth {...register("city")} />
							<TextField
								label="Postal code"
								fullWidth
								{...register("postalCode")}
							/>
						</Stack>
						<TextField
							label="Billing email"
							type="email"
							fullWidth
							error={Boolean(errors.contactEmail)}
							helperText={errors.contactEmail?.message}
							{...register("contactEmail")}
						/>
						<TextField label="Tax ID" fullWidth {...register("taxId")} />
						<Stack
							direction="row"
							spacing={2}
							sx={{ alignItems: "center", flexWrap: "wrap" }}
						>
							<Avatar
								alt="Business logo preview"
								src={logo || undefined}
								sx={{ width: 56, height: 56 }}
							/>
							<Button
								type="button"
								variant="outlined"
								onClick={() => fileInputRef.current?.click()}
							>
								Replace logo
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg"
								hidden
								onChange={onLogoChange}
							/>
						</Stack>
						{logoError ? (
							<Typography color="error" variant="body2">
								{logoError}
							</Typography>
						) : (
							<Typography variant="body2" color="text.secondary">
								PNG or JPEG, up to 500 KB.
							</Typography>
						)}

						<Divider />
						<TextField
							label="Home currency"
							select
							required
							fullWidth
							defaultValue={initialProfile.currency}
							error={Boolean(errors.currency)}
							helperText={errors.currency?.message}
							{...register("currency")}
						>
							{CURRENCIES.map((code) => (
								<MenuItem key={code} value={code}>
									{code}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Default tax rate (%)"
							required
							fullWidth
							inputMode="decimal"
							error={Boolean(errors.defaultTaxRate)}
							helperText={
								errors.defaultTaxRate?.message ??
								"Applied to new invoices; you can override per invoice."
							}
							{...register("defaultTaxRate")}
						/>
						<TextField
							label="Default payment terms"
							select
							fullWidth
							defaultValue={initialProfile.paymentTerms}
							{...register("paymentTerms")}
						>
							{PAYMENT_TERMS.map((terms) => (
								<MenuItem key={terms} value={terms}>
									{TERMS_LABELS[terms]}
								</MenuItem>
							))}
						</TextField>

						{profileStatus ? (
							<Alert severity={profileStatus.severity}>
								{profileStatus.message}
							</Alert>
						) : null}
						<Button type="submit" variant="contained" disabled={isSubmitting}>
							{isSubmitting ? "Saving…" : "Save profile"}
						</Button>
					</Stack>
				</Box>
			</Paper>

			<Paper sx={{ p: { xs: 2, sm: 3 } }} component="section">
				<Stack
					direction="row"
					spacing={1}
					sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
				>
					<Typography variant="h6">Rate rules</Typography>
					<Chip label={`${rules.length}`} size="small" />
				</Stack>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Keyword rules let PayTrail price tasks automatically later (e.g.
					keyword “standard clean” → 45.50). Changes save when you leave a
					field.
				</Typography>
				<Stack spacing={2}>
					{rules.map((row, index) => (
						<Stack
							key={row.id}
							direction="row"
							spacing={1}
							sx={{ alignItems: "flex-start" }}
						>
							<TextField
								label="Keyword"
								size="small"
								fullWidth
								value={row.keyword}
								onChange={(e) =>
									handleRuleChange(row.id, { keyword: e.target.value })
								}
								onBlur={() => handleRuleBlur(row)}
							/>
							<TextField
								label="Rate"
								size="small"
								fullWidth
								inputMode="decimal"
								slotProps={{
									input: {
										startAdornment: (
											<InputAdornment position="start">
												{initialProfile.currency}
											</InputAdornment>
										),
									},
								}}
								value={row.rate}
								onChange={(e) =>
									handleRuleChange(row.id, { rate: e.target.value })
								}
								onBlur={() => handleRuleBlur(row)}
							/>
							<Stack sx={{ flexShrink: 0 }}>
								<IconButton
									aria-label={`Move rule ${index + 1} up`}
									disabled={index === 0}
									size="small"
									onClick={() => handleMoveRule(index, -1)}
								>
									<ArrowUpwardIcon fontSize="small" />
								</IconButton>
								<IconButton
									aria-label={`Move rule ${index + 1} down`}
									disabled={index === rules.length - 1}
									size="small"
									onClick={() => handleMoveRule(index, 1)}
								>
									<ArrowDownwardIcon fontSize="small" />
								</IconButton>
							</Stack>
							{confirmDeleteId === row.id ? (
								<Stack
									direction="row"
									spacing={0.5}
									sx={{ flexShrink: 0, alignItems: "center" }}
								>
									<Button
										size="small"
										variant="contained"
										color="error"
										onClick={() => handleDeleteRule(row.id)}
									>
										Delete
									</Button>
									<Button size="small" onClick={cancelDeleteRule}>
										Cancel
									</Button>
								</Stack>
							) : (
								<IconButton
									aria-label={`Delete rule ${index + 1}`}
									size="small"
									onClick={() => {
										setConfirmDeleteId(row.id);
										if (deleteTimerRef.current)
											clearTimeout(deleteTimerRef.current);
										deleteTimerRef.current = setTimeout(
											() => setConfirmDeleteId(null),
											4000,
										);
									}}
								>
									<DeleteIcon fontSize="small" />
								</IconButton>
							)}
						</Stack>
					))}
					{ruleError ? <Alert severity="error">{ruleError}</Alert> : null}
					<Button type="button" variant="outlined" onClick={handleAddRule}>
						Add rate rule
					</Button>
				</Stack>
			</Paper>
		</Container>
	);
}
