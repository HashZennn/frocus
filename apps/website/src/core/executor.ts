import type { VoiceCommand } from "#/types/voice.ts";

type Payload = Record<string, string | number | boolean | null>
type NavigateFn = (to: string) => void
type ActionHandler = (payload: Payload) => void | Promise<void>
type FormHandler = (fields: Payload) => void

export interface ExecutorConfig {
    navigate: NavigateFn,
    actions: Record<string, ActionHandler>,
    forms: Record<string, FormHandler>
}

export interface ExecuteResult {
    success: boolean;
    message: string;
}

export function createExecutor(config: ExecutorConfig) {
    return async function executeCommand(command: VoiceCommand): Promise<ExecuteResult> {
        switch (command.type) {
            case "navigation":
                config.navigate(command.target)
                return {
                    success: true,
                    message: ""
                }

            default:
                return {
                    success: false,
                    message: ""
                }
        }
    }
}