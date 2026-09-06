import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Create your account — PayTrail" };

export default function SignUpPage() {
	return (
		<AuthShell
			subtitle="Start invoicing in minutes"
			title="Create your account"
		>
			<SignUpForm />
		</AuthShell>
	);
}
