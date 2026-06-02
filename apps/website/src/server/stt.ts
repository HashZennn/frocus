import { createServerFn } from "@tanstack/react-start";
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

        const { audioBase64, mimeType = "audio/webm", languageCode = "ne" } = data
        const audioBuffer = Buffer.from(audioBase64, "base64")

        const form = new FormDataNode()
        form.append("file", audioBuffer, {
            filename: "recording.webm",
            contentType: mimeType
        })

        return {
            transcript: ""
        }
    })