import { Prisma, type Project } from "../generated/prisma/client";
import type { ProjectInput } from "./clients";
import { prisma } from "./db";

/**
 * Data layer for projects. Every function verifies that the parent
 * client belongs to the session user before touching project rows.
 */

export type ProjectWithRelations = Project;

/** Thrown when the client or project does not exist for the given user. */
export class NotFoundError extends Error {
	readonly code = "NOT_FOUND" as const;
	constructor(message: string) {
		super(message);
		this.name = "NotFoundError";
	}
}

export class DuplicateProjectNameError extends Error {
	readonly code = "DUPLICATE_PROJECT_NAME" as const;
	constructor() {
		super("A project with this name already exists for this client");
		this.name = "DuplicateProjectNameError";
	}
}

async function getOwnedClient(userId: string, clientId: string) {
	const client = await prisma.client.findFirst({
		where: { id: clientId, userId },
		select: { id: true },
	});
	if (!client) {
		throw new NotFoundError("Client not found for this user");
	}
	return client;
}

function isDuplicateNameError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

export async function createProject(
	userId: string,
	clientId: string,
	input: ProjectInput,
): Promise<Project> {
	await getOwnedClient(userId, clientId);
	try {
		return await prisma.project.create({
			data: { ...input, clientId },
		});
	} catch (error) {
		if (isDuplicateNameError(error)) {
			throw new DuplicateProjectNameError();
		}
		throw error;
	}
}

export async function listProjects(
	userId: string,
	clientId: string,
): Promise<Project[]> {
	await getOwnedClient(userId, clientId);
	return prisma.project.findMany({
		where: { clientId },
		orderBy: { name: "asc" },
	});
}

export async function updateProject(
	userId: string,
	clientId: string,
	projectId: string,
	input: ProjectInput,
): Promise<Project> {
	await getOwnedClient(userId, clientId);
	const existing = await prisma.project.findFirst({
		where: { id: projectId, clientId },
		select: { id: true },
	});
	if (!existing) {
		throw new NotFoundError("Project not found for this client");
	}
	try {
		return await prisma.project.update({
			where: { id: projectId },
			data: input,
		});
	} catch (error) {
		if (isDuplicateNameError(error)) {
			throw new DuplicateProjectNameError();
		}
		throw error;
	}
}

export type DeleteProjectResult =
	| { ok: true }
	| { ok: false; reason: "INVOICES_ATTACHED"; invoiceCount: number };

export async function deleteProject(
	userId: string,
	clientId: string,
	projectId: string,
): Promise<DeleteProjectResult> {
	await getOwnedClient(userId, clientId);
	const existing = await prisma.project.findFirst({
		where: { id: projectId, clientId },
		select: { id: true },
	});
	if (!existing) {
		throw new NotFoundError("Project not found for this client");
	}

	const invoiceCount = await prisma.invoice.count({ where: { projectId } });
	if (invoiceCount > 0) {
		return { ok: false, reason: "INVOICES_ATTACHED", invoiceCount };
	}

	await prisma.project.delete({ where: { id: projectId } });
	return { ok: true };
}
