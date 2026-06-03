import { createServerFn } from "@tanstack/react-start";
import axios, { AxiosError } from "axios";
import FormDataNode from "form-data";
import { z } from "zod";

const TranscribeInput = z.object({
    audioBase64: z.string(),
    mimeType: z.string().optional(),
    languageCode: z.string().optional()
})

export interface TranscribeResult {
    transcript: string
}

export const TranscribeAudio = createServerFn({ method: "POST" })
    .inputValidator(TranscribeInput)
    .handler(async ({ data }): Promise<TranscribeResult> => {

        const apikey = process.env.ELEVENLABS_API_KEY

        if (!apikey) {
            throw new Error("[STT] ELEVENLABS_API_KEY isnot configured")
        }

        const { audioBase64, mimeType = "audio/webm", languageCode = "ne" } = data
        const audioBuffer = Buffer.from(audioBase64, "base64")

        const form = new FormDataNode()
        form.append("file", audioBuffer, {
            filename: "recording.webm",
            contentType: mimeType
        })
        form.append("model_id", "scribe_v1")
        form.append("language_code", languageCode)

        try {
            const response = await axios.post<{ text: string }>("https://api.elevenlabs.io/v1/speech-to-text", form, {
                headers: {
                    "xi-api-key": apikey,
                    ...form.getHeaders()
                },
                maxBodyLength: Infinity,
                timeout: 30_000
            })

            return {
                transcript: response.data.text ?? ""
            }
        } catch (error) {
            const axiosError = error as AxiosError<{ detail?: unknown }>
            const detail = axiosError.response?.data.detail
            const message = (typeof detail === "string" ? detail : JSON.stringify(detail)) ?? axiosError.message ?? "Unknown Elevenlabs Error"

            throw new Error(`[STT] Elevenlabs request failed: ${message}`)
        }

    })