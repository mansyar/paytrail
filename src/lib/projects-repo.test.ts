import { afterAll, afterEach, describe, expect, it } from "vitest";
import { auth } from "./auth";
import {
	createProject,
	deleteProject,
	listProjects,
	updateProject,
} from "./projects-repo";
import { prisma } from "./db";
import { createClient } from "./clients-repo";

const createdUserIds: string[] = [];

afterEach(async () => {
	for (const id of createdUserIds.splice(0)) {
		await prisma.user.delete({ where: { id } });
	}
});

afterAll(async () => {
	await prisma.$disconnect();
});

async function createTestUser(): Promise<string> {
	const email = `proj-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
	const { user } = await auth.api.signUpEmail({
		body: { name: "Project Test", email, password: "correct-horse-battery" },
	});
	createdUserIds.push(user.id);
	return user.id;
}

describe("project repo — session-scoped CRUD", () => {
	it("createProject persists a project under an owned client", async () => {
		const userId = await createTestUser();
		const client = await createClient(userId, { name: "Villa Owner" });

		const project = await createProject(userId, client.id, {
			name: "Deep Clean",
			description: "Full turn-over clean",
		});
		expect(project.name).toBe("Deep Clean");
		expect(project.clientId).toBe(client.id);
	});

	it("createProject refuses clients not owned by the session user", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(otherUserId, { name: "Not Mine" });

		await expect(
			createProject(userId, client.id, { name: "Sneaky" }),
		).rejects.toThrow();
	});

	it("createProject rejects duplicate project names per client with a typed error", async () => {
		const userId = await createTestUser();
		const client = await createClient(userId, { name: "Dup Client" });
		await createProject(userId, client.id, { name: "Deep Clean" });

		await expect(
			createProject(userId, client.id, { name: "Deep Clean" }),
		).rejects.toMatchObject({ code: "DUPLICATE_PROJECT_NAME" });

		// Same name under a different client of the same user is fine.
		const otherClient = await createClient(userId, { name: "Other Client" });
		await expect(
			createProject(userId, otherClient.id, { name: "Deep Clean" }),
		).resolves.toMatchObject({ name: "Deep Clean" });
	});

	it("listProjects returns only that client's projects in alphabetical order", async () => {
		const userId = await createTestUser();
		const client = await createClient(userId, { name: "List Client" });
		const otherClient = await createClient(userId, { name: "Other Client" });
		await createProject(userId, client.id, { name: "Window Wash" });
		await createProject(userId, client.id, { name: "Basic Clean" });
		await createProject(userId, otherClient.id, { name: "Unrelated" });

		const projects = await listProjects(userId, client.id);
		expect(projects.map((p) => p.name)).toEqual(["Basic Clean", "Window Wash"]);
	});

	it("updateProject renames for the owner and refuses cross-user or cross-client access", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(userId, { name: "Owner" });
		const project = await createProject(userId, client.id, { name: "Before" });

		const renamed = await updateProject(userId, client.id, project.id, {
			name: "After",
		});
		expect(renamed?.name).toBe("After");

		await expect(
			updateProject(otherUserId, client.id, project.id, { name: "Hacked" }),
		).rejects.toThrow();

		const otherClient = await createClient(userId, { name: "Other" });
		await expect(
			updateProject(userId, otherClient.id, project.id, { name: "Misfiled" }),
		).rejects.toThrow();
	});

	it("deleteProject removes for the owner and refuses cross-user access", async () => {
		const userId = await createTestUser();
		const otherUserId = await createTestUser();
		const client = await createClient(userId, { name: "Owner" });
		const project = await createProject(userId, client.id, { name: "Doomed" });

		await expect(
			deleteProject(otherUserId, client.id, project.id),
		).rejects.toThrow();

		expect(await deleteProject(userId, client.id, project.id)).toEqual({
			ok: true,
		});
		const projects = await listProjects(userId, client.id);
		expect(projects).toEqual([]);
	});
});
