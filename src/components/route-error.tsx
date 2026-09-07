"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";

export function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<Stack
			component="main"
			spacing={2}
			sx={{
				alignItems: "center",
				justifyContent: "center",
				minHeight: "50vh",
				p: { xs: 2, sm: 4 },
			}}
		>
			<Typography component="h1" variant="h6">
				Something went wrong
			</Typography>
			<Typography color="text.secondary" variant="body2">
				We couldn&apos;t load this page. Please try again.
			</Typography>
			<Button onClick={reset} variant="contained">
				Try again
			</Button>
		</Stack>
	);
}
