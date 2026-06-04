import type { VoiceCommandContext, VoiceCommandResult, VoiceState } from "#/types/voice.ts";
import { useCallback, useRef, useState } from "react";


export interface UseVoiceCommandOptions {
    context: VoiceCommandContext;
    onCommand?: (result: VoiceCommandResult) => void;
    onError?: (error: Error) => void;
    minConfidence?: number;
    maxDurationMs?: number;
}

export interface UseVoiceCommandReturn {
    state: VoiceState;
    isRecording: boolean;
    isProcessing: boolean;
    result: VoiceCommandResult | null;
    transcript: string | null;
    error: Error | null;
    start: () => Promise<void>;
    stop: () => void;
    reset: () => void;
}

export function useVoiceCommand({
    context,
    onCommand,
    onError,
    minConfidence = 0.70,
    maxDurationMs = 30_000
}: UseVoiceCommandOptions): UseVoiceCommandReturn {
    const [state, setState] = useState<VoiceState>("idle")
    const [result, setResult] = useState<VoiceCommandResult | null>(null)
    const [transcript, setTranscript] = useState<string | null>(null)
    const [error, setError] = useState<Error | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Array<Blob>>([])
    const startTimeRef = useRef<number>(0)
    const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const stopStream = () => {
        streamRef.current?.getTracks().map((track) => track.stop())
        streamRef.current = null
    }

    const clearTimer = () => {
        if (maxTimerRef.current) {
            clearTimeout(maxTimerRef.current)
        }
        maxTimerRef.current = null
    }

    const fail = (error: Error) => {
        stopStream()
        clearTimer()
        setState("error")
        setError(error)
        onError?.(error)
    }


    const start = async () => {
        if (state === "recording") {
            return
        }

        setError(null)
        setResult(null)
        setTranscript(null)
        chunksRef.current = []

        let stream: MediaStream;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (err) {
            return fail(new Error("Microphone access denied. Please allow microphone permissions."))
        }

        streamRef.current = stream

        // mimeType list from google
        const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(mType => MediaRecorder.isTypeSupported(mType) ?? "")

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = event => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data)
            }
        }

        recorder.onstop = async () => {
            clearTimer()
            stopStream()
            const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" })
        }


        recorder.onerror = (err) => {
            fail(new Error("MediaRecorder: ", err?.error.message))
        }
    }

    const stop = () => {

    }

    const reset = () => {

    }

    return {
        state,
        result,
        transcript,
        error,
        start,
        stop,
        reset,
        isProcessing: state === "transcribing" || state === "parsing",
        isRecording: state === "recording"
    }
}