import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { InvoiceTotals } from "@/lib/invoice-totals";
import { formatMoney } from "@/lib/money-format";

export interface PreviewItem {
	description: string;
	amountMinor: number;
}

export interface InvoicePreviewProps {
	profile: {
		businessName: string;
		addressLines: string[];
		contactEmail: string | null;
		taxId: string | null;
		logo: string | null;
	};
	clientName: string;
	invoiceNumber: string;
	issueDate: string;
	dueDate: string;
	currencyCode: string;
	items: PreviewItem[];
	totals: InvoiceTotals;
}

export function InvoicePreview({
	profile,
	clientName,
	invoiceNumber,
	issueDate,
	dueDate,
	currencyCode,
	items,
	totals,
}: InvoicePreviewProps) {
	return (
		<Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
			<Stack spacing={2}>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					spacing={1}
					sx={{
						alignItems: { xs: "flex-start", sm: "center" },
						justifyContent: "space-between",
					}}
				>
					<Box>
						{profile.logo && (
							<Box
								alt={`${profile.businessName} logo`}
								component="img"
								sx={{ maxHeight: 48, mb: 1, maxWidth: 160 }}
								src={profile.logo}
							/>
						)}
						<Typography variant="subtitle1">{profile.businessName}</Typography>
						{profile.addressLines.map((line) => (
							<Typography color="text.secondary" key={line} variant="body2">
								{line}
							</Typography>
						))}
						{profile.contactEmail && (
							<Typography color="text.secondary" variant="body2">
								{profile.contactEmail}
							</Typography>
						)}
						{profile.taxId && (
							<Typography color="text.secondary" variant="body2">
								Tax ID: {profile.taxId}
							</Typography>
						)}
					</Box>
					<Box sx={{ textAlign: { sm: "right" } }}>
						<Typography variant="h6">Invoice</Typography>
						<Typography color="text.secondary" variant="body2">
							{invoiceNumber || "—"}
						</Typography>
					</Box>
				</Stack>

				<Divider />

				<Stack
					direction="row"
					spacing={2}
					sx={{ justifyContent: "space-between" }}
					useFlexGap
				>
					<Box>
						<Typography color="text.secondary" variant="caption">
							Bill to
						</Typography>
						<Typography variant="body1">{clientName}</Typography>
					</Box>
					<Box sx={{ textAlign: { sm: "right" } }}>
						<Typography color="text.secondary" variant="caption">
							Issued
						</Typography>
						<Typography variant="body2">{issueDate || "—"}</Typography>
						<Typography color="text.secondary" variant="caption">
							Due
						</Typography>
						<Typography variant="body2">{dueDate || "—"}</Typography>
					</Box>
				</Stack>

				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Description</TableCell>
							<TableCell align="right">Amount</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{items.length === 0 && (
							<TableRow>
								<TableCell colSpan={2}>
									<Typography color="text.secondary" variant="body2">
										No items yet
									</Typography>
								</TableCell>
							</TableRow>
						)}
						{items.map((item) => (
							<TableRow key={`${item.description}-${item.amountMinor}`}>
								<TableCell>{item.description || "—"}</TableCell>
								<TableCell align="right">
									{formatMoney(item.amountMinor, currencyCode)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>

				<Stack sx={{ alignSelf: "flex-end", minWidth: 200 }} spacing={0.5}>
					<Stack direction="row" sx={{ justifyContent: "space-between" }}>
						<Typography color="text.secondary" variant="body2">
							Subtotal
						</Typography>
						<Typography variant="body2">
							{formatMoney(totals.subtotalMinor, currencyCode)}
						</Typography>
					</Stack>
					{totals.discountAppliedMinor > 0 && (
						<Stack direction="row" sx={{ justifyContent: "space-between" }}>
							<Typography color="text.secondary" variant="body2">
								Discount
							</Typography>
							<Typography variant="body2">
								−{formatMoney(totals.discountAppliedMinor, currencyCode)}
							</Typography>
						</Stack>
					)}
					<Stack direction="row" sx={{ justifyContent: "space-between" }}>
						<Typography color="text.secondary" variant="body2">
							Tax
						</Typography>
						<Typography variant="body2">
							{formatMoney(totals.taxMinor, currencyCode)}
						</Typography>
					</Stack>
					<Divider />
					<Stack direction="row" sx={{ justifyContent: "space-between" }}>
						<Typography variant="subtitle1">Total</Typography>
						<Typography variant="subtitle1">
							{formatMoney(totals.totalMinor, currencyCode)}
						</Typography>
					</Stack>
				</Stack>
			</Stack>
		</Paper>
	);
}
