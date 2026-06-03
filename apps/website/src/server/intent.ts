import { createServerFn } from "@tanstack/react-start";
import type { VoiceCommand } from "#/types/voice.ts";
import { z } from "zod";

const ParseIntentInput = z.object({
    transcript: z.string(),
    context: z.object({
        routes: z.array(z.object({
            path: z.string(),
            name: z.string()
        })).optional(),
        forms: z.record(z.string(), z.any()).optional(),
        actions: z.record(z.string(), z.any()).optional(),
        language: z.string().optional()
    })
})

export interface ParseIntentResult {
    commands: Array<VoiceCommand>;
}

export const parseIntent = createServerFn({ method: "POST" })
    .inputValidator(ParseIntentInput)
    .handler()