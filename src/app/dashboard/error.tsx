"use client";

export default function Error({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<main
			style={{
				display: "grid",
				placeItems: "center",
				minHeight: "60vh",
				textAlign: "center",
			}}
		>
			<div>
				<h1>Something went wrong</h1>
				<p>This page failed to load. Try again.</p>
				<button onClick={reset}>Try again</button>
			</div>
		</main>
	);
}
