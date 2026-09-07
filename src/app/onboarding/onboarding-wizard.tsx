"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import DeleteIcon from "@mui/icons-material/Delete";
import {
	Alert,
	Avatar,
	Box,
	Button,
	Container,
	Divider,
	IconButton,
	MenuItem,
	Stack,
	Step,
	StepLabel,
	Stepper,
	TextField,
	Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type FieldPath, useFieldArray, useForm } from "react-hook-form";
import {
	CURRENCIES,
	type OnboardingInput,
	onboardingInputSchema,
	PAYMENT_TERMS,
} from "@/lib/schemas";
import { saveOnboardingAction } from "./actions";

type FormValues = OnboardingInput;

const STEPS = [
	"Business identity",
	"Financial defaults",
	"Rate rules",
] as const;

type WizardFieldPath = FieldPath<FormValues>;

const STEP_FIELDS: Record<number, WizardFieldPath[]> = {
	0: [
		"profile.businessName",
		"profile.addressLine1",
		"profile.addressLine2",
		"profile.city",
		"profile.postalCode",
		"profile.contactEmail",
		"profile.taxId",
		"profile.logo",
	],
	1: ["profile.currency", "profile.defaultTaxRate", "profile.paymentTerms"],
	2: ["rateRules"],
};

const LOGO_MAX_BYTES = 500 * 1024;

export function OnboardingWizard({ nextPath }: { nextPath: string }) {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [logoError, setLogoError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const {
		register,
		control,
		watch,
		setValue,
		trigger,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(onboardingInputSchema),
		mode: "onBlur",
		defaultValues: {
			profile: {
				businessName: "",
				addressLine1: "",
				addressLine2: "",
				city: "",
				postalCode: "",
				contactEmail: "",
				taxId: "",
				logo: "",
				currency: "USD",
				defaultTaxRate: "0",
				paymentTerms: "due_on_receipt",
			},
			rateRules: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "rateRules",
	});

	const logo = watch("profile.logo") as string | undefined;

	const onLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		setLogoError(null);
		if (!file) return;
		if (!/^image\/(png|jpeg)$/.test(file.type)) {
			setLogoError("Logo must be a PNG or JPEG image.");
			return;
		}
		if (file.size > LOGO_MAX_BYTES) {
			setLogoError("Logo must be 500 KB or smaller.");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setValue("profile.logo", String(reader.result), {
				shouldValidate: true,
			});
		};
		reader.readAsDataURL(file);
	};

	const goNext = async () => {
		const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });
		if (valid) {
			setStep((s) => Math.min(s + 1, STEPS.length - 1));
		}
	};

	const goBack = () => setStep((s) => Math.max(s - 1, 0));

	const onSubmit = handleSubmit(async (values) => {
		const result = await saveOnboardingAction(values);
		if (result.ok) {
			router.push(nextPath);
			router.refresh();
		} else {
			setError("root", { message: result.message });
		}
	});

	return (
		<Container maxWidth="sm" sx={{ py: 4, px: { xs: 2 } }}>
			<Typography variant="h4" component="h1" gutterBottom>
				Set up your business
			</Typography>
			<Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
				{STEPS.map((label) => (
					<Step key={label}>
						<StepLabel>{label}</StepLabel>
					</Step>
				))}
			</Stepper>

			<Box component="form" onSubmit={onSubmit} noValidate>
				{errors.root?.message ? (
					<Alert severity="error" sx={{ mb: 2 }}>
						{errors.root.message}
					</Alert>
				) : null}

				{step === 0 ? (
					<Stack spacing={2}>
						<TextField
							label="Business name"
							required
							fullWidth
							error={Boolean(errors.profile?.businessName)}
							helperText={errors.profile?.businessName?.message}
							{...register("profile.businessName")}
						/>
						<TextField
							label="Address line 1"
							fullWidth
							{...register("profile.addressLine1")}
						/>
						<TextField
							label="Address line 2"
							fullWidth
							{...register("profile.addressLine2")}
						/>
						<Stack direction="row" spacing={2}>
							<TextField label="City" fullWidth {...register("profile.city")} />
							<TextField
								label="Postal code"
								fullWidth
								{...register("profile.postalCode")}
							/>
						</Stack>
						<TextField
							label="Billing email"
							type="email"
							fullWidth
							error={Boolean(errors.profile?.contactEmail)}
							helperText={errors.profile?.contactEmail?.message}
							{...register("profile.contactEmail")}
						/>
						<TextField
							label="Tax ID"
							fullWidth
							{...register("profile.taxId")}
						/>
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
								variant="outlined"
								onClick={() => fileInputRef.current?.click()}
							>
								Upload logo
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
					</Stack>
				) : null}

				{step === 1 ? (
					<Stack spacing={2}>
						<TextField
							label="Home currency"
							select
							required
							fullWidth
							defaultValue="USD"
							error={Boolean(errors.profile?.currency)}
							helperText={errors.profile?.currency?.message}
							{...register("profile.currency")}
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
							error={Boolean(errors.profile?.defaultTaxRate)}
							helperText={
								errors.profile?.defaultTaxRate?.message ??
								"Applied to new invoices; you can override per invoice."
							}
							{...register("profile.defaultTaxRate")}
						/>
						<TextField
							label="Default payment terms"
							select
							fullWidth
							defaultValue="due_on_receipt"
							{...register("profile.paymentTerms")}
						>
							{PAYMENT_TERMS.map((terms) => (
								<MenuItem key={terms} value={terms}>
									{terms === "due_on_receipt"
										? "Due on receipt"
										: terms === "net_7"
											? "Net 7"
											: terms === "net_14"
												? "Net 14"
												: terms === "net_30"
													? "Net 30"
													: "Net 60"}
								</MenuItem>
							))}
						</TextField>
					</Stack>
				) : null}

				{step === 2 ? (
					<Stack spacing={2}>
						<Typography variant="body2" color="text.secondary">
							Keyword rules let PayTrail price tasks automatically later (e.g.
							keyword “standard clean” → 45.50). You can skip this step.
						</Typography>
						{fields.map((field, index) => (
							<Stack
								key={field.id}
								direction="row"
								spacing={2}
								sx={{ alignItems: "flex-start" }}
							>
								<TextField
									label="Keyword"
									fullWidth
									error={Boolean(errors.rateRules?.[index]?.keyword)}
									helperText={errors.rateRules?.[index]?.keyword?.message}
									{...register(`rateRules.${index}.keyword` as const)}
								/>
								<TextField
									label="Flat rate"
									fullWidth
									inputMode="decimal"
									error={Boolean(errors.rateRules?.[index]?.rate)}
									helperText={errors.rateRules?.[index]?.rate?.message}
									{...register(`rateRules.${index}.rate` as const)}
								/>
								<IconButton
									aria-label={`Remove rule ${index + 1}`}
									onClick={() => remove(index)}
								>
									<DeleteIcon />
								</IconButton>
							</Stack>
						))}
						<Button
							variant="outlined"
							onClick={() => append({ keyword: "", rate: "" })}
						>
							Add rate rule
						</Button>
					</Stack>
				) : null}

				<Divider sx={{ my: 3 }} />
				<Stack
					direction="row"
					spacing={2}
					sx={{ justifyContent: "space-between" }}
				>
					<Button onClick={goBack} disabled={step === 0}>
						Back
					</Button>
					{step < STEPS.length - 1 ? (
						<Button variant="contained" onClick={goNext}>
							Next
						</Button>
					) : (
						<Button type="submit" variant="contained" disabled={isSubmitting}>
							{isSubmitting ? "Saving…" : "Finish setup"}
						</Button>
					)}
				</Stack>
			</Box>
		</Container>
	);
}
