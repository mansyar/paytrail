"use client";

import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProjectAction } from "@/lib/clients-actions";
import { ProjectDialog } from "./project-dialog";

export interface ProjectRow {
	id: string;
	name: string;
	description: string | null;
}

export interface ProjectsSectionProps {
	clientId: string;
	projects: ProjectRow[];
}

export function ProjectsSection({ clientId, projects }: ProjectsSectionProps) {
	const router = useRouter();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<ProjectRow | null>(null);
	const [deleting, setDeleting] = useState<ProjectRow | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const closeDialog = () => {
		setDialogOpen(false);
		setEditing(null);
	};

	const confirmDelete = async () => {
		if (!deleting) return;
		setIsDeleting(true);
		setDeleteError(null);
		try {
			const result = await deleteProjectAction(clientId, deleting.id);
			if (!result.ok) {
				setDeleteError("This project no longer exists.");
				return;
			}
			setDeleting(null);
			router.refresh();
		} catch {
			setDeleteError("Something went wrong. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				spacing={2}
				sx={{
					mb: projects.length > 0 ? 1 : 0,
					alignItems: { xs: "flex-start", sm: "center" },
					justifyContent: "space-between",
				}}
			>
				<Typography component="h2" variant="h6">
					Projects
				</Typography>
				<Button onClick={() => setDialogOpen(true)} variant="contained">
					Add project
				</Button>
			</Stack>

			{projects.length === 0 ? (
				<Typography color="text.secondary" variant="body2">
					No projects yet — add one to start tracking work for this client.
				</Typography>
			) : (
				<List disablePadding>
					{projects.map((project, index) => (
						<ListItem
							divider={index < projects.length - 1}
							key={project.id}
							secondaryAction={
								<Stack direction="row" spacing={0.5}>
									<Button
										onClick={() => setEditing(project)}
										size="small"
										sx={{ minHeight: 44 }}
									>
										Rename
									</Button>
									<Button
										color="error"
										onClick={() => setDeleting(project)}
										size="small"
										sx={{ minHeight: 44 }}
									>
										Delete
									</Button>
								</Stack>
							}
						>
							<ListItemText
								primary={project.name}
								secondary={project.description ?? undefined}
							/>
						</ListItem>
					))}
				</List>
			)}

			<ProjectDialog
				clientId={clientId}
				key={editing?.id ?? "new"}
				onClose={closeDialog}
				open={dialogOpen || editing !== null}
				project={editing ?? undefined}
			/>

			{deleting ? (
				<Stack
					spacing={1}
					sx={{
						border: 1,
						borderColor: "divider",
						borderRadius: 2,
						mt: 2,
						p: 2,
					}}
				>
					<Typography variant="body2">
						Delete project &quot;{deleting.name}&quot;? This cannot be undone.
					</Typography>
					{deleteError ? (
						<Typography color="error" variant="body2">
							{deleteError}
						</Typography>
					) : null}
					<Stack direction="row" spacing={1}>
						<Button onClick={() => setDeleting(null)} size="small">
							Cancel
						</Button>
						<Button
							color="error"
							disabled={isDeleting}
							onClick={confirmDelete}
							size="small"
							variant="contained"
						>
							Delete
						</Button>
					</Stack>
				</Stack>
			) : null}
		</Paper>
	);
}
