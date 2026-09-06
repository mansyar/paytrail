import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function AuthShell({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children: ReactNode;
}) {
	return (
		<Stack
			sx={{
				alignItems: "center",
				justifyContent: "center",
				minHeight: "100vh",
				p: 2,
			}}
		>
			<Card sx={{ width: "100%", maxWidth: 400 }}>
				<CardContent sx={{ display: "grid", gap: 3, p: 4 }}>
					<Stack spacing={0.5}>
						<Typography component="h1" variant="h4">
							{title}
						</Typography>
						{subtitle ? (
							<Typography color="text.secondary" variant="body2">
								{subtitle}
							</Typography>
						) : null}
					</Stack>
					{children}
				</CardContent>
			</Card>
		</Stack>
	);
}
