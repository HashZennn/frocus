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
            case "navigation": {
                config.navigate(command.target)
                return {
                    success: true,
                    message: `Navigated to ${command.target}`
                }
            }
            case "form_fill": {
                const handler = config.forms[command.target]
                if (!handler) {
                    return {
                        success: false,
                        message: `No form handler for ${command.target}`
                    }
                }

                handler(command.payload)

                return {
                    success: true,
                    message: ""
                }
            }

            case "action": {
                const handler = config.actions[command.action]
                if (!handler) {
                    return {
                        success: false,
                        message: `No handler for ${command.action}`
                    }
                }

                handler(command.payload ?? {})
                return {
                    success: true,
                    message: ""
                }
            }

            case "unknown": {
                return {
                    success: false,
                    message: "Command is not recognized"
                }
            }
        }
    }
}