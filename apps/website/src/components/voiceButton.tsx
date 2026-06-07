import { useVoiceCommand } from "#/hooks/useVoiceCommandOptions.ts";
import type { VoiceCommandContext, VoiceCommandResult } from "#/types/voice.ts";
import type React from "react";

interface VoiceButtonProps {
    context: VoiceCommandContext;
    onCommand: (result: VoiceCommandResult) => void;
    onError?: (error: Error) => void;
    minConfidence?: number;
    maxDurationMs?: number;
    className?: string;
    idleLabel?: string;
    children?: React.ReactNode;
}

export function VoiceButton({
    context,
    onCommand,
    onError,
    minConfidence,
    maxDurationMs,
    className = "",
    idleLabel = "Hold to speak",
    children,
}: VoiceButtonProps): React.ReactNode {
    const { state, isRecording,isProcessing, transcript, error, start, stop, reset } = useVoiceCommand({
        context, onCommand, onError, minConfidence, maxDurationMs
    })

    return <></>
}