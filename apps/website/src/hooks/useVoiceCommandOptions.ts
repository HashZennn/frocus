import type { VoiceCommandContext, VoiceCommandResult, VoiceState } from "#/types/voice.ts";
import { useState } from "react";


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

    const start = async () => {

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