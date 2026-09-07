"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { clientSchema } from "@/lib/clients";
import { createClientAction, updateClientAction } from "@/lib/clients-actions";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";

type ClientFormValues = z.input<typeof clientSchema>;

export interface ClientDialogProps {
	open: boolean;
	onClose: () => void;
	/** Present for edit mode; absent for create. */
	client?: {
		id: string;
		name: string;
		email: string | null;
		address: string | null;
		currencyCode: string;
		notes: string | null;
	};
}

export function ClientDialog({ open, onClose, client }: ClientDialogProps) {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ClientFormValues>({
		resolver: zodResolver(clientSchema),
		defaultValues: {
			name: client?.name ?? "",
			email: client?.email ?? "",
			address: client?.address ?? "",
			currencyCode: client?.currencyCode ?? DEFAULT_CURRENCY,
			notes: client?.notes ?? "",
		},
	});

	const onSubmit = async (values: ClientFormValues) => {
		setFormError(null);
		try {
			const result = client
				? await updateClientAction(client.id, values)
				: await createClientAction(values);
			if (!result.ok) {
				setFormError("This client no longer exists.");
				return;
			}
			onClose();
			router.refresh();
		} catch {
			setFormError("Something went wrong. Please try again.");
		}
	};

	return (
		<Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
			<DialogTitle>{client ? "Edit client" : "Add client"}</DialogTitle>
			<Stack
				component="form"
				noValidate
				onSubmit={handleSubmit(onSubmit)}
				sx={{ px: 0 }}
			>
				<DialogContent>
					<Stack spacing={2}>
						{formError ? (
							<MuiAlert severity="error" variant="outlined">
								{formError}
							</MuiAlert>
						) : null}
						<TextField
							error={Boolean(errors.name)}
							fullWidth
							helperText={errors.name?.message}
							label="Name"
							required
							{...register("name")}
						/>
						<TextField
							error={Boolean(errors.email)}
							fullWidth
							helperText={errors.email?.message}
							label="Email"
							type="email"
							{...register("email")}
						/>
						<TextField
							fullWidth
							label="Billing address"
							multiline
							{...register("address")}
						/>
						<TextField
							defaultValue={DEFAULT_CURRENCY}
							fullWidth
							label="Currency"
							select
							{...register("currencyCode")}
						>
							{CURRENCIES.map((code) => (
								<MenuItem key={code} value={code}>
									{code}
								</MenuItem>
							))}
						</TextField>
						<TextField
							fullWidth
							label="Notes"
							multiline
							{...register("notes")}
						/>
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={onClose}>Cancel</Button>
					<Button disabled={isSubmitting} type="submit" variant="contained">
						{client ? "Save changes" : "Add client"}
					</Button>
				</DialogActions>
			</Stack>
		</Dialog>
	);
}
