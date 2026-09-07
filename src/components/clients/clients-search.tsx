"use client";

import TextField from "@mui/material/TextField";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Debounced search box that mirrors its value into the `?q=` URL param. */
export function ClientsSearch() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [value, setValue] = useState(searchParams.get("q") ?? "");

	useEffect(() => {
		const timer = setTimeout(() => {
			const params = new URLSearchParams(searchParams);
			if (value.trim()) {
				params.set("q", value.trim());
			} else {
				params.delete("q");
			}
			const query = params.toString();
			router.replace(query ? `/clients?${query}` : "/clients");
		}, 300);
		return () => clearTimeout(timer);
	}, [value, router, searchParams]);

	return (
		<TextField
			autoComplete="off"
			fullWidth
			label="Search clients"
			onChange={(event) => setValue(event.target.value)}
			size="small"
			slotProps={{ htmlInput: { type: "search" } }}
			sx={{ maxWidth: 360 }}
			value={value}
		/>
	);
}
