"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import MuiAlert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const signInSchema = z.object({
	email: z.email("Enter a valid email"),
	password: z.string().min(1, "Password is required"),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignInValues>({
		resolver: zodResolver(signInSchema),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = async (values: SignInValues) => {
		setFormError(null);
		const { error } = await authClient.signIn.email(values);
		if (error) {
			setFormError(error.message ?? "Invalid email or password");
			return;
		}
		router.push("/dashboard");
	};

	return (
		<Stack
			component="form"
			noValidate
			onSubmit={handleSubmit(onSubmit)}
			spacing={2}
		>
			{formError ? (
				<MuiAlert severity="error" variant="outlined">
					{formError}
				</MuiAlert>
			) : null}
			<TextField
				autoComplete="email"
				error={Boolean(errors.email)}
				fullWidth
				helperText={errors.email?.message}
				label="Email"
				type="email"
				{...register("email")}
			/>
			<TextField
				autoComplete="current-password"
				error={Boolean(errors.password)}
				fullWidth
				helperText={errors.password?.message}
				label="Password"
				type="password"
				{...register("password")}
			/>
			<Button
				disabled={isSubmitting}
				fullWidth
				type="submit"
				variant="contained"
			>
				Sign in
			</Button>
			<Stack direction="row" sx={{ justifyContent: "center" }} spacing={0.5}>
				<Typography variant="body2">New to PayTrail?</Typography>
				<Link
					component={NextLink}
					href="/signup"
					underline="hover"
					variant="body2"
				>
					Create account
				</Link>
			</Stack>
		</Stack>
	);
}
