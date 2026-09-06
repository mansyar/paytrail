import { createTheme } from "@mui/material/styles";

/**
 * PayTrail visual baseline (conductor/product-guidelines.md):
 * professional, minimal, fast — light theme, one accent color,
 * sentence-case verb buttons, tabular numerals for currency.
 */
export const theme = createTheme({
	palette: {
		mode: "light",
		primary: { main: "#2563eb" },
		secondary: { main: "#475569" },
		background: { default: "#fafafa" },
	},
	typography: {
		fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
		h1: { fontWeight: 650 },
		h2: { fontWeight: 650 },
		h3: { fontWeight: 600 },
		h4: { fontWeight: 600 },
		button: { textTransform: "none", fontWeight: 600 },
	},
	shape: { borderRadius: 8 },
	components: {
		MuiCssBaseline: {
			styleOverrides: {
				body: { fontFeatureSettings: '"tnum"' },
			},
		},
		MuiButton: {
			defaultProps: { disableElevation: true },
		},
	},
});
