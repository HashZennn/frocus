import { createServerFn } from "@tanstack/react-start";
import type { ActionCommand, FormFillCommand, NavigationCommand, UnknownCommand, VoiceCommand, VoiceCommandContext } from "#/types/voice.ts";
import { z } from "zod";
import axios, { type AxiosError } from "axios";

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

function unknownFallback(reason: string): UnknownCommand {
    console.warn("[INTENT] ", reason)

    return {
        type: "unknown",
        confidence: 0,
        rawTranscript: reason
    }
}

function validateSingleCommand(raw: unknown, context: VoiceCommandContext): VoiceCommand {
    if (typeof raw !== "object" || raw === null) {
        return unknownFallback("No Object in command array");
    }

    const object = raw as Record<string, unknown>

    switch (object.type) {
        case "navigation": {
            const allowedPaths = (context.routes ?? []).map(route => route.path)

            if (!allowedPaths.includes(object.target as string)) {
                return unknownFallback(`Route "${object.target}" is not in allowedlist`)
            }

            return {
                type: "navigation",
                target: object.target as string,
                confidence: (object.confidence as number) ?? 0,
            } satisfies NavigationCommand
        }
    
        case "form_fill": {
            const formSchema = context.forms?.[object.target as string]

            if (!formSchema) {
                return unknownFallback(`Form "${object.target}" isnot registered`)
            }

            const rawPayload = (object.payload ?? {}) as Record<string, unknown>

            const missing = [{}] // TODO: identify missing fields

            if (missing.length > 0) {
                return unknownFallback(`Required form fields not found in speech: "${missing.join(", ")}"`)
            }

            // TODO: obtain data
            
            return {
                type: "form_fill",
                target: object.target as string,
                payload: {}, // TODO: add data
                confidence: (object.confidence as number) ?? 0
            } satisfies FormFillCommand
        }

        case "action": {
            const actionSchema = context.actions?.[object.action as string]

            if (!actionSchema) {
                return unknownFallback(`Action "${object.action}" isnot registered`)
            }

            const rawPayload = (object.payload ?? {}) as Record<string, unknown>

            const missing = [{}] // TODO: identify missing fields

            if (missing.length > 0) {
                return unknownFallback(`Required params for action "${object.action}" not found in speech: ${missing.join(", ")}. Ask user to be more specific`)
            }

            // TODO: obtain data

            return {
                type: "action",
                action: object.action as string,
                payload: {}, // TODO: add data
                confidence: (object.confidence as number) ?? 0,
            } satisfies ActionCommand
        }

        case "unknown": {
            return {
                type: "unknown",
                confidence: (object.confidence as number) ?? 0,
                rawTranscript: (object.rawTranscript as string) ?? ""
            } satisfies UnknownCommand
        }

        default:
            return unknownFallback(`Unknown Command type: ${object.type}`)
    }
}

export const parseIntent = createServerFn({ method: "POST" })
    .inputValidator(ParseIntentInput)
    .handler(async ({ data }): Promise<ParseIntentResult> => {
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

            const commands = rawArray.map(item => validateSingleCommand(item, data.context))

            return {
                commands
            }

        } catch (error) {
            const axiosError = error as AxiosError<{ detail?: unknown }>
            const detail = axiosError.response?.data.detail
            const message = (typeof detail === "string" ? detail : JSON.stringify(detail)) ?? axiosError.message ?? "Unknown OpenRouter Error"

            throw new Error(`[INTENT] Openrouter request failed: ${message}`)
        }
    })