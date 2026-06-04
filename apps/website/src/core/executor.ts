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
                const filled = Object.entries(command.payload).map(([key, value]) => `${key}=${value}`).join(", ")

                return {
                    success: true,
                    message: `Updated form "${command.target}": ${filled}`
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
                const withPayload = command.payload && Object.keys(command.payload).length > 0 ? `with ${JSON.stringify(command.payload)}` : ""

                return {
                    success: true,
                    message: `Executed "${command.action}" ${withPayload}`
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

export async function executeAll(commands: Array<VoiceCommand>, executor: ReturnType<typeof createExecutor>, stopOnFailure = true): Promise<Array<ExecuteResult>> {
    const results: Array<ExecuteResult> = []

    for (const command of commands) {
        const result = await executor(command)
        results.push(result)

        if (!result.success && stopOnFailure) {
            break
        }
    }

    return results
}