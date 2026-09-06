import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in — PayTrail" };

export default function LoginPage() {
	return (
		<AuthShell subtitle="Welcome back" title="Sign in">
			<SignInForm />
		</AuthShell>
	);
}
