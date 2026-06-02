export type VoiceCommandType = "navigation" | "form_fill" | "action" | "unknown"

export interface NavigationCommand {
    type: "navigation";
    target: string;
    confidence: number;
}

export interface FormFillCommand {
    type: "form_fill";
    target: string;
    payload: Record<string, string | number | boolean | null>;
    confidence: number;
}

export interface ActionCommand {
    type: "action";
    action: string;
    payload?: Record<string, string | number | boolean | null>;
    confidence: number;
}

export interface UnknownCommand {
    type: "unknown";
    confidence: number;
    rawTranscript: string;
}

export type VoiceCommand = NavigationCommand | FormFillCommand | ActionCommand | UnknownCommand