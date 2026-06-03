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

