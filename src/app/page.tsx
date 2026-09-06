import { Box, Container, Typography } from "@mui/material";

export default function Home() {
	return (
		<Box
			component="main"
			sx={{
				minHeight: "100dvh",
				display: "grid",
				placeItems: "center",
			}}
		>
			<Container maxWidth="sm" sx={{ textAlign: "center" }}>
				<Typography variant="h1" component="h1" sx={{ fontSize: 40, mb: 1 }}>
					PayTrail
				</Typography>
				<Typography color="text.secondary">
					Fast invoicing for freelancers.
				</Typography>
			</Container>
		</Box>
	);
}
