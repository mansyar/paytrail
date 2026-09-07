"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { ClientInput, ProjectInput } from "./clients";
import {
	createClient as createClientRepo,
	deleteClient as deleteClientRepo,
	updateClient as updateClientRepo,
} from "./clients-repo";
import {
	createProject as createProjectRepo,
	DuplicateProjectNameError,
	deleteProject as deleteProjectRepo,
	updateProject as updateProjectRepo,
} from "./projects-repo";

/**
 * "use server" wrappers around the data layer. The session user is
 * resolved here and passed down explicitly — the repos then scope
 * every query and mutation by that user id.
 */

export type ProjectActionResult =
	| { ok: true }
	| { ok: false; reason: "DUPLICATE_PROJECT_NAME" };

async function requireUserId(): Promise<string> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		redirect("/login");
	}
	return session.user.id;
}

export async function createClientAction(input: ClientInput) {
	return createClientRepo(await requireUserId(), input);
}

export async function updateClientAction(id: string, input: ClientInput) {
	return updateClientRepo(await requireUserId(), id, input);
}

export async function deleteClientAction(id: string) {
	return deleteClientRepo(await requireUserId(), id);
}

export async function createProjectAction(
	clientId: string,
	input: ProjectInput,
): Promise<ProjectActionResult> {
	try {
		await createProjectRepo(await requireUserId(), clientId, input);
		return { ok: true };
	} catch (error) {
		if (error instanceof DuplicateProjectNameError) {
			return { ok: false, reason: "DUPLICATE_PROJECT_NAME" };
		}
		throw error;
	}
}

export async function updateProjectAction(
	clientId: string,
	projectId: string,
	input: ProjectInput,
): Promise<ProjectActionResult> {
	try {
		await updateProjectRepo(await requireUserId(), clientId, projectId, input);
		return { ok: true };
	} catch (error) {
		if (error instanceof DuplicateProjectNameError) {
			return { ok: false, reason: "DUPLICATE_PROJECT_NAME" };
		}
		throw error;
	}
}

export async function deleteProjectAction(clientId: string, projectId: string) {
	await deleteProjectRepo(await requireUserId(), clientId, projectId);
}
