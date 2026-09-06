import { describe, expect, it } from "vitest";
import { theme } from "./theme";

describe("theme", () => {
	it("defaults to the light palette", () => {
		expect(theme.palette.mode).toBe("light");
	});

	it("keeps sentence-case verb buttons", () => {
		expect(theme.typography.button?.textTransform).toBe("none");
	});
});
