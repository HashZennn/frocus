import { db } from "./db"
import { sessions } from "./schema"
import * as http from "http"
import { WebSocketServer, WebSocket } from "ws";

const PORT_RANGE_START = 7423;
const PORT_RANGE_END = 7433;
const MAX_MESSAGE_BYTES = 256 * 1024;
const ALLOWED_ORIGIN =
    process.env.FROCUS_EXTENSION_ORIGIN ||
    "brave://extensions/?id=fbihhjcmfoikfgflklihoacmfdfaloak";

interface EventEnvelope {
    entryId: string;
    event: "session_end" | "focus_lost" | "focus_gained" | "page_meta_scanned" | "rule_violation" | "system_event"
    [key: string]: any;
}

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const registry = new Map<string, WebSocket>()

async function startServer() {
    const server = http.createServer()
    let port = PORT_RANGE_START

    while (port <= PORT_RANGE_END) {
        try {
            await new Promise<void>((resolve, reject) =>
                server
                    .listen(port, "127.0.0.1")
                    .once("listening", resolve)
                    .once("error", reject)
            )
            break
        } catch (error) {
            port++
        }
    }

    sendToTauri("frocus://ws_port", port)

    const webSocketServer = new WebSocketServer({ noServer: true })

    server.on("upgrade", (request, socket, head) => {
        if (request.headers.origin !== ALLOWED_ORIGIN && !(process.env.NODE_ENV === "development")) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
            return socket.destroy()
        }
        webSocketServer.handleUpgrade(request, socket, head, (websocket) => {
            webSocketServer.emit("connection", websocket)
        })
    })

    webSocketServer.on("connection", (websocket) => {
        let clientId = ""
        let pendingAcknowledgements: Array<string> = []

        websocket.on("message", async (data: Buffer, isBinary) => {
            if (isBinary && data.byteLength >= MAX_MESSAGE_BYTES) return

            const payload = JSON.parse(data.toString("utf-8"))

            if (!clientId) {
                clientId = payload.clientId
                registry.set(clientId, websocket)
                sendToTauri("frocus://browser_connected", payload)
                return
            }

            pendingAcknowledgements.push(payload.entryId)
            await onEvent(payload as EventEnvelope, clientId)

            if (pendingAcknowledgements.length >= 10 || payload.event === "session_end" || payload.event === "rule_violation" || payload.event === "system_event") {
                websocket.send(JSON.stringify({ type: "ack", ids: pendingAcknowledgements }))
                pendingAcknowledgements = []
            }
        })

        websocket.on("close", () => {
            if (pendingAcknowledgements.length) {
                websocket.send(JSON.stringify({ type: "ack", ids: pendingAcknowledgements }))
            }
            registry.delete(clientId)
            sendToTauri("frocus://browser_disconnected", clientId)
        })
    })
}

async function onEvent(envelope: EventEnvelope, clientId: string) {
    if (envelope.event === "session_end") {
        const toDate = (value: any) => {
            if (value === null || value === undefined) return null
            if (value instanceof Date) return value
            const date = new Date(value)
            return Number.isFinite(date.getTime()) ? date : null
        }

        const insertObj: Record<string, any> = {
            id: crypto.randomUUID(),
            clientId,
            browserType: envelope.browserType || "unknown",
            url: envelope.url,
            hostname: envelope.hostname,
            pathname: envelope.pathname,
            meta: envelope.meta === undefined || envelope.meta === null ? null : JSON.stringify(envelope.meta),
            durationMs: envelope.durationMs,
            startedAt: toDate(envelope.startedAt),
            endedAt: toDate(envelope.endAt ?? envelope.endedAt),
            matchedRules: JSON.stringify(envelope.ruleIds || []),
            primaryRuleId: envelope.primaryRuleId
        }
        
        await db.insert(sessions).values(insertObj).catch((error: unknown) => console.error("[SIDECAR] Session DB Error: ", error))

        sendToTauri("frocus://session_end", { clientId, event: envelope })
    } else if (envelope.event === "page_meta_scanned") {
        sendToTauri("frocus://page_meta_scanned", {
            clientId,
            meta: envelope.meta,
            url: envelope.url
        })
    } else {
        sendToTauri(`frocus://${envelope.event}`, {
            clientId,
            ...envelope
        })
    }
}

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

startServer().catch((error) => {
    console.error("[SIDECAR ERROR]", error);
    process.exit(1);
})