import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";

export function RouteLoading() {
	return (
		<Stack
			component="main"
			sx={{
				alignItems: "center",
				justifyContent: "center",
				minHeight: "50vh",
				p: { xs: 2, sm: 4 },
			}}
		>
			<CircularProgress />
		</Stack>
	);
}
