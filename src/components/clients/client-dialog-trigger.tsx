"use client";

import Button from "@mui/material/Button";
import { useState } from "react";
import { ClientDialog } from "./client-dialog";

export function ClientDialogTrigger() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setOpen(true)} variant="contained">
				Add client
			</Button>
			<ClientDialog onClose={() => setOpen(false)} open={open} />
		</>
	);
}
