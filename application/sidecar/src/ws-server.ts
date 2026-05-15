import { PrismaClient } from "@prisma/client/extension";

const PORT_RANGE_START = 7423;
const PORT_RANGE_END = 7433;
const MAX_MESSAGE_BYTES = 256 * 1024;
const ALLOWED_ORIGIN =
    process.env.FROCUS_EXTENSION_ORIGIN ||
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

const registry = new Map<string, WebSocket>()
const prisma = new PrismaClient()


function sendToTauri(eventName: string, payload: any) {
    process.stdout.write(JSON.stringify({ event: eventName, payload }) + "\n")
}

process.stdin.on("data", (data) => {
    try {
        const { action, clientId, command } = JSON.parse(data.toString())

        if (action === "send_to_client") {
            const ws = registry.get(clientId)
            if (ws?.readyState === WebSocket.OPEN) {
                ws?.send(JSON.stringify(command))
            }
        }
    } catch (error) {
        
    }
})