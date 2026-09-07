import { Prisma } from "../generated/prisma/client";
import type { ProjectInput } from "./clients";
import { prisma } from "./db";

/**
 * Data layer for projects. Every function verifies that the parent
 * client belongs to the session user before touching project rows.
 */

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
		throw new Error("Client not found for this user");
	}
	return client;
}

export async function createProject(
	userId: string,
	clientId: string,
	input: ProjectInput,
) {
	await getOwnedClient(userId, clientId);
	try {
		return await prisma.project.create({
			data: { ...input, clientId },
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new DuplicateProjectNameError();
		}
		throw error;
	}
}

export async function listProjects(userId: string, clientId: string) {
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
) {
	await getOwnedClient(userId, clientId);
	const existing = await prisma.project.findFirst({
		where: { id: projectId, clientId },
		select: { id: true },
	});
	if (!existing) {
		throw new Error("Project not found for this client");
	}
	try {
		return await prisma.project.update({
			where: { id: projectId },
			data: input,
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new DuplicateProjectNameError();
		}
		throw error;
	}
}

export async function deleteProject(
	userId: string,
	clientId: string,
	projectId: string,
): Promise<{ ok: true }> {
	await getOwnedClient(userId, clientId);
	const existing = await prisma.project.findFirst({
		where: { id: projectId, clientId },
		select: { id: true },
	});
	if (!existing) {
		throw new Error("Project not found for this client");
	}
	await prisma.project.delete({ where: { id: projectId } });
	return { ok: true };
}
