import { describe, expect, it, vi } from "vitest";
import { createExecutor, executeAll } from "./executor.ts";

describe("createExecutor", () => {
	it("awaits async action handlers before returning success", async () => {
		let completed = false;

		const executor = createExecutor({
			navigate: vi.fn(),
			actions: {
				save: async () => {
					await Promise.resolve();
					completed = true;
				},
			},
			forms: {},
		});

		const result = await executor({
			type: "action",
			action: "save",
			confidence: 1,
		});

		expect(result).toEqual({
			success: true,
			message: 'Executed "save"',
		});
		expect(completed).toBe(true);
	});

	it("returns a failure result for missing handlers", async () => {
		const executor = createExecutor({
			navigate: vi.fn(),
			actions: {},
			forms: {},
		});

		const result = await executeAll(
			[
				{
					type: "action",
					action: "missing",
					confidence: 1,
				},
			],
			executor,
		);

		expect(result).toEqual([
			{
				success: false,
				message: "No handler for missing",
			},
		]);
	});
});