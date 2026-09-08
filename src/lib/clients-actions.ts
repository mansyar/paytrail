"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { ClientInput, ProjectInput } from "./clients";
import {
	createClient as createClientRepo,
	type DeleteClientResult,
	deleteClient as deleteClientRepo,
	updateClient as updateClientRepo,
} from "./clients-repo";
import {
	createProject as createProjectRepo,
	DuplicateProjectNameError,
	deleteProject as deleteProjectRepo,
	NotFoundError,
	updateProject as updateProjectRepo,
} from "./projects-repo";

/**
 * "use server" wrappers around the data layer. The session user is
 * resolved here and passed down explicitly — the repos then scope
 * every query and mutation by that user id.
 *
 * This is the mutation boundary: every action returns a typed result.
 * Domain errors are mapped to result reasons and never thrown raw to
 * the client.
 */

async function requireUserId(): Promise<string> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		redirect("/login");
	}
	return session.user.id;
}

export type MutationResult =
	| { ok: true }
	| {
			ok: false;
			reason: "NOT_FOUND" | "DUPLICATE_PROJECT_NAME" | "INVOICES_ATTACHED";
			invoiceCount?: number;
	  };

export async function createClientAction(
	input: ClientInput,
): Promise<MutationResult> {
	await createClientRepo(await requireUserId(), input);
	return { ok: true };
}

export async function updateClientAction(
	id: string,
	input: ClientInput,
): Promise<MutationResult> {
	const updated = await updateClientRepo(await requireUserId(), id, input);
	return updated ? { ok: true } : { ok: false, reason: "NOT_FOUND" };
}

export async function deleteClientAction(
	id: string,
): Promise<DeleteClientResult> {
	return deleteClientRepo(await requireUserId(), id);
}

function toMutationResult(error: unknown): MutationResult | undefined {
	if (error instanceof DuplicateProjectNameError) {
		return { ok: false, reason: "DUPLICATE_PROJECT_NAME" };
	}
	if (error instanceof NotFoundError) {
		return { ok: false, reason: "NOT_FOUND" };
	}
	return undefined;
}

export async function createProjectAction(
	clientId: string,
	input: ProjectInput,
): Promise<MutationResult> {
	try {
		await createProjectRepo(await requireUserId(), clientId, input);
		return { ok: true };
	} catch (error) {
		const result = toMutationResult(error);
		if (result) return result;
		throw error;
	}
}

export async function updateProjectAction(
	clientId: string,
	projectId: string,
	input: ProjectInput,
): Promise<MutationResult> {
	try {
		await updateProjectRepo(await requireUserId(), clientId, projectId, input);
		return { ok: true };
	} catch (error) {
		const result = toMutationResult(error);
		if (result) return result;
		throw error;
	}
}

export async function deleteProjectAction(
	clientId: string,
	projectId: string,
): Promise<MutationResult> {
	try {
		const result = await deleteProjectRepo(
			await requireUserId(),
			clientId,
			projectId,
		);
		if (!result.ok) return result;
		return { ok: true };
	} catch (error) {
		const result = toMutationResult(error);
		if (result) return result;
		throw error;
	}
}
