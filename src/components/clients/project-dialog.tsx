"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { projectSchema } from "@/lib/clients";
import {
	createProjectAction,
	updateProjectAction,
} from "@/lib/clients-actions";

type ProjectFormValues = z.input<typeof projectSchema>;

export interface ProjectDialogProps {
	open: boolean;
	onClose: () => void;
	clientId: string;
	/** Present for rename mode; absent for create. */
	project?: { id: string; name: string; description: string | null };
}

export function ProjectDialog({
	open,
	onClose,
	clientId,
	project,
}: ProjectDialogProps) {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ProjectFormValues>({
		resolver: zodResolver(projectSchema),
		defaultValues: {
			name: project?.name ?? "",
			description: project?.description ?? "",
		},
	});

	const onSubmit = async (values: ProjectFormValues) => {
		setFormError(null);
		try {
			const result = project
				? await updateProjectAction(clientId, project.id, values)
				: await createProjectAction(clientId, values);
			if (!result.ok) {
				setFormError(
					result.reason === "DUPLICATE_PROJECT_NAME"
						? "A project with this name already exists for this client."
						: "This project no longer exists.",
				);
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
			<DialogTitle>{project ? "Rename project" : "Add project"}</DialogTitle>
			<Stack component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
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
							fullWidth
							label="Description"
							multiline
							{...register("description")}
						/>
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 2 }}>
					<Button onClick={onClose}>Cancel</Button>
					<Button disabled={isSubmitting} type="submit" variant="contained">
						{project ? "Save" : "Add project"}
					</Button>
				</DialogActions>
			</Stack>
		</Dialog>
	);
}
