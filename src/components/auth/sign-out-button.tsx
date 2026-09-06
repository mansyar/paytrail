"use client";

import Button from "@mui/material/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
	const router = useRouter();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const onSignOut = async () => {
		setIsSigningOut(true);
		await authClient.signOut();
		router.push("/login");
	};

	return (
		<Button disabled={isSigningOut} onClick={onSignOut} variant="outlined">
			Sign out
		</Button>
	);
}
