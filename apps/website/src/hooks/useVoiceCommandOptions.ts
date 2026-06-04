import type { VoiceCommandContext, VoiceCommandResult, VoiceState } from "#/types/voice.ts";


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

