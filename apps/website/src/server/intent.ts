import { createServerFn } from "@tanstack/react-start";
import type { VoiceCommand } from "#/types/voice.ts";
import { z } from "zod";
import axios from "axios";

const zodVoiceSchema = z.union([
    z.custom<z.ZodTypeAny>(),
    z.record(z.string(), z.unknown())
])

const ParseIntentInput = z.object({
    transcript: z.string(),
    context: z.object({
        routes: z.array(z.object({
            path: z.string(),
            name: z.string()
        })).optional(),
        forms: z.record(z.string(), zodVoiceSchema).optional(),
        actions: z.record(z.string(), zodVoiceSchema).optional(),
        language: z.string().optional()
    })
})

export interface ParseIntentResult {
    commands: Array<VoiceCommand>;
}

export interface AIResponse {
    choices: Array<{
        message: {
            content: string;
        }
    }>
}

export const parseIntent = createServerFn({ method: "POST" })
    .inputValidator(ParseIntentInput)
    .handler(async ({ data }) => {
        const apiKey = process.env.OPENROUTER_API_KEY

        if (!apiKey) {
            throw new Error("[INTENT] OPENROUTER_API_KEY isnot configured")
        }

        const systemPrompt = ""

        try {
            const response = await axios.post<AIResponse>("https://openrouter.ai/api/v1/chat/completions", {
                model: "poolside/laguna-m.1:free", // I find this powerful and free on Openrouter
                temperature: 0, // I set it for deterministic output
                max_tokens: 1024,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Transcript: "${data.transcript}"` }
                ]
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                timeout: 15_000
            })

            const raw = response.data.choices?.[0]?.message?.content ?? ""
            const cleaned = raw.trim().replace(/^```json|^```|```$/g, "").trim(); // If ```json ...``` content is there, this will cleaned that

            let parsed: unknown

            try { // I used try-catch block so that if non-parsable content is there, app doesnot break
                parsed = JSON.parse(cleaned)
            } catch (error) {
                console.error("[INTENT] JSON parsing failed")
            }

            const rawArray: Array<unknown> = Array.isArray(parsed) ? parsed : [parsed]

            const commands = rawArray.map(item => ({

            }))

            return {
                commands
            }

        } catch (error) {


            
        }
    })