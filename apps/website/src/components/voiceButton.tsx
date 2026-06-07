import { useVoiceCommand } from "#/hooks/useVoiceCommandOptions.ts";
import { cn } from "#/lib/utils.ts";
import type { VoiceCommandContext, VoiceCommandResult } from "#/types/voice.ts";
import type React from "react";
import { FaMicrophone, FaSpinner, FaStop } from "react-icons/fa6";

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
    const { state, isRecording, isProcessing, transcript, error, start, stop, reset } = useVoiceCommand({
        context, onCommand, onError, minConfidence, maxDurationMs
    })

    const stateLabel: Record<typeof state, string> = {
        idle: idleLabel,
        recording: "Listening...",
        transcribing: "Transcribing...",
        parsing: "Understanding...",
        ready: "Done",
        error: "Error. Tap to retry"
    }

    const stateColor: Record<typeof state, string> = {
        idle: "#2563EB",
        recording: "#2563EB",
        transcribing: "#2563EB",
        parsing: "#2563EB",
        ready: "#2563EB",
        error: "#2563EB"
    }

    const handleClick = () => {
        if (["idle", "ready", "error"].includes(state)) {
            if (["error", "ready"].includes(state)) {
                reset()
            }
            start()
        } else if (isRecording) {
            stop()
        }
    }

    const handlePointerDown = () => {
        if (["idle", "ready", "error"].includes(state)) {
            if (state !== "idle") {
                reset()
            }
            start()
        }
    }

    const handlePointerUp = () => {
        if (isRecording) {
            stop()
        }
    }

    return (
        <div className={cn("inline-flex flex-col items-center gap-2", className)}>
            <button
                type="button"
                aria-label={stateLabel[state]}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={!isRecording && !isProcessing ? handleClick : undefined}
                disabled={isProcessing}
                className={cn("w-18 h-18 rounded-full border-none text-white flex items-center justify-center", isProcessing ? "cursor-not-allowed" : "cursor-pointer", isRecording ? "scale-108" : "scale-100")}
                style={{
                    backgroundColor: stateColor[state],
                }}
            >
                {
                    children ? children : isProcessing ? <FaSpinner /> : isRecording ? <FaStop /> : <FaMicrophone />
                }
            </button>

            <span className="text-xs font-medium" style={{ color: stateColor[state] }}>
                {stateLabel[state]}
            </span>

            {
                transcript ? (
                    <span className="text-[11px] max-w-60 text-center text-[#6B7280] italic">
                        "{transcript}"
                    </span>
                ) : null
            }

            {
                error ? (
                    <span className="text-[11px] max-w-60 text-center" style={{ color: stateColor.error }}>
                        {error.message}
                    </span>
                ) : null
            }

        </div>
    )
}