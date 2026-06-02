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


export interface VoiceCommandContext {
    routes?: Array<Route>;
    forms?: Record<string, Array<Payload>>;
    actions?: Record<string, Array<Payload>>;
    language?: string;
}

export type Route = {
    path: string;
    name: string;
}

export type Payload = {
    param: string;
    type: string;
    required: boolean;
}

export type Types = "string" | "number" | "boolean" | "bigint" | "null" | "undefined" | "NaN"
export type FullTypes = Types | `${Types}[]` | `Array<${Types}>` | `Record<${Types}, ${Types}>`

// Example:

// const voiceContext: VoiceCommandContext = {
//     actions: {
//         "add_user": [{
//             param: "name", type: "string", required: true
//         }]
//     },
//     forms: {
//         product_form: [{
//             param: "category",
//             type: "string",
//             required: true
//         }]
//     }
// }