"use client";

import { Button } from "@mui/material";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useState } from "react";
import { ClientDialog } from "./client-dialog";

export interface ClientRow {
	id: string;
	name: string;
	email: string | null;
	currencyCode: string;
	_projectCount: number;
}

export interface ClientsTableProps {
	clients: ClientRow[];
}

export function ClientsTable({ clients }: ClientsTableProps) {
	const [editing, setEditing] = useState<ClientRow | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	if (clients.length === 0) {
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
					No clients yet. Add your first client to start invoicing.
				</Typography>
				<Button onClick={() => setDialogOpen(true)} variant="contained">
					Add client
				</Button>
				<ClientDialog onClose={() => setDialogOpen(false)} open={dialogOpen} />
			</Stack>
		);
	}

	return (
		<>
			<TableContainer sx={{ overflowX: "auto" }}>
				<Table size="medium">
					<TableHead>
						<TableRow>
							<TableCell>Name</TableCell>
							<TableCell>Email</TableCell>
							<TableCell align="right">Currency</TableCell>
							<TableCell align="right">Projects</TableCell>
							<TableCell align="right">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{clients.map((client) => (
							<TableRow hover key={client.id}>
								<TableCell>
									<Link
										component={NextLink}
										href={`/clients/${client.id}`}
										underline="hover"
									>
										{client.name}
									</Link>
								</TableCell>
								<TableCell>{client.email ?? "—"}</TableCell>
								<TableCell align="right">{client.currencyCode}</TableCell>
								<TableCell align="right">{client._projectCount}</TableCell>
								<TableCell align="right">
									<Button
										onClick={() => {
											setEditing(client);
											setDialogOpen(true);
										}}
										size="small"
										sx={{ minHeight: 44 }}
									>
										Edit
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
			<ClientDialog
				key={editing?.id ?? "create"}
				client={
					editing
						? {
								id: editing.id,
								name: editing.name,
								email: editing.email,
								address: null,
								currencyCode: editing.currencyCode,
								notes: null,
							}
						: undefined
				}
				onClose={() => setDialogOpen(false)}
				open={dialogOpen}
			/>
		</>
	);
}
