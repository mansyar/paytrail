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

const signUpSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<SignUpValues>({
		resolver: zodResolver(signUpSchema),
		defaultValues: { name: "", email: "", password: "" },
	});

	const onSubmit = async (values: SignUpValues) => {
		setFormError(null);
		const { error } = await authClient.signUp.email(values);
		if (error) {
			setFormError(error.message ?? "Sign up failed");
			return;
		}
		// Better Auth creates a session on signup — go straight to the dashboard.
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
				autoComplete="name"
				error={Boolean(errors.name)}
				fullWidth
				helperText={errors.name?.message}
				label="Name"
				{...register("name")}
			/>
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
				autoComplete="new-password"
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
				Create account
			</Button>
			<Stack direction="row" sx={{ justifyContent: "center" }} spacing={0.5}>
				<Typography variant="body2">Already have an account?</Typography>{" "}
				<NextLink href="/login" passHref legacyBehavior>
					<Link underline="hover" variant="body2">
						Sign in
					</Link>
				</NextLink>
			</Stack>
		</Stack>
	);
}
