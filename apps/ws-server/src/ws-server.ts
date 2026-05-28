import { db } from "./db";
import type {
    ClientMessage,
    DesktopCommand,
    EventEnvelope,
    HandshakeMessage,
    SessionEndEvent,
    SessionInsert,
} from "@frocus/behavior-core";
import { sessions } from "@frocus/behavior-core";
import * as http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT_RANGE_START = 7423;
const PORT_RANGE_END = 7433;
const MAX_MESSAGE_BYTES = 256 * 1024;
const BIND_HOST = process.env.FROCUS_BIND_HOST || "127.0.0.1";
const EXTENSION_ID =
    process.env.FROCUS_EXTENSION_ID || "fbihhjcmfoikfgflklihoacmfdfaloak";
const EXTRA_ALLOWED_ORIGIN = process.env.FROCUS_EXTENSION_ORIGIN;

const ALLOWED_ORIGINS = new Set(
    [
        `chrome-extension://${EXTENSION_ID}`,
        `brave-extension://${EXTENSION_ID}`,
        `moz-extension://${EXTENSION_ID}`,
        EXTRA_ALLOWED_ORIGIN,
    ].filter(Boolean) as Array<string>,
);

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const registry = new Map<string, WebSocket>();

async function startServer() {
    const server = http.createServer();
    let port = PORT_RANGE_START;

    while (port <= PORT_RANGE_END) {
        try {
            await new Promise<void>((resolve, reject) =>
                server
                    .listen(port, BIND_HOST)
                    .once("listening", resolve)
                    .once("error", reject),
            );
            break;
        } catch (error) {
            port++;
        }
    }

    sendToTauri("frocus://ws_port", port);

    const webSocketServer = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
        if (!isAllowedOrigin(request.headers.origin)) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            return socket.destroy();
        }
        webSocketServer.handleUpgrade(request, socket, head, (websocket) => {
            webSocketServer.emit("connection", websocket);
        });
    });

    webSocketServer.on("connection", (websocket) => {
        let clientId = "";
        let pendingAcknowledgements: Array<string> = [];

        websocket.on("message", async (data: Buffer) => {
            const payload = parseClientMessage(data);
            if (!payload) return;

            if (payload.type === "handshake") {
                clientId = payload.clientId;
                registry.set(clientId, websocket);
                sendToTauri("frocus://browser_connected", payload);
                return;
            }

            if (!clientId) return;

            pendingAcknowledgements.push(payload.entryId);
            await onEvent(payload, clientId);

            if (
                pendingAcknowledgements.length >= 10 ||
                payload.event === "session_end" ||
                payload.event === "rule_violation" ||
                payload.event === "system_event"
            ) {
                if (websocket.readyState === WebSocket.OPEN) {
                    websocket.send(
                        JSON.stringify({ type: "ack", ids: pendingAcknowledgements }),
                    );
                }
                pendingAcknowledgements = [];
            }
        });

        websocket.on("close", () => {
            registry.delete(clientId);
            sendToTauri("frocus://browser_disconnected", clientId);
        });
    });
}

async function onEvent(envelope: EventEnvelope, clientId: string) {
    if (envelope.event === "session_end") {
        const event = envelope as SessionEndEvent;
        const toDate = (value: unknown) => {
            if (value === null || value === undefined) return null;
            if (value instanceof Date) return value;
            const date = new Date(value as number);
            return Number.isFinite(date.getTime()) ? date : null;
        };

        const startedAt = toDate(event.startedAt);
        const endedAt = toDate(event.endAt);

        if (!startedAt || !endedAt) {
            console.warn("[SIDECAR] Skipping session with invalid timestamps", event);
            return;
        }

        const insertObj: SessionInsert = {
            id: crypto.randomUUID(),
            clientId,
            browserType: event.browserType || "unknown",
            url: event.url,
            hostname: event.hostname,
            pathname: event.pathname,
            meta:
                event.meta === undefined || event.meta === null
                    ? null
                    : JSON.stringify(event.meta),
            durationMs: event.durationMs,
            startedAt,
            endedAt,
            matchedRules: JSON.stringify(event.ruleIds || []),
            primaryRuleId: event.primaryRuleId,
        };

        await db
            .insert(sessions)
            .values(insertObj)
            .catch((error: unknown) =>
                console.error("[SIDECAR] Session DB Error: ", error),
            );

        sendToTauri("frocus://session_end", { clientId, event: envelope });
    } else if (envelope.event === "page_meta_scanned") {
        sendToTauri("frocus://page_meta_scanned", {
            clientId,
            meta: envelope.meta,
            url: envelope.url,
        });
    } else {
        sendToTauri(`frocus://${envelope.event}`, {
            clientId,
            ...envelope,
        });
    }
}

function sendToTauri(eventName: string, payload: any) {
    process.stdout.write(JSON.stringify({ event: eventName, payload }) + "\n");
}

function parseClientMessage(data: Buffer): ClientMessage | null {
    if (data.byteLength >= MAX_MESSAGE_BYTES) return null;

    let payload: unknown;

    try {
        payload = JSON.parse(data.toString("utf-8")) as unknown;
    } catch (error) {
        console.warn("[SIDECAR] Unparsable message", error);
        return null;
    }

    if (!isRecord(payload)) return null;

    if (isHandshakeMessage(payload)) return payload;
    if (isEventEnvelope(payload)) return payload;

    return null;
}

function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    if (process.env.NODE_ENV !== "production") {
        return isExtensionOrigin(origin) || ALLOWED_ORIGINS.has(origin);
    }
    return ALLOWED_ORIGINS.has(origin);
}

function isExtensionOrigin(origin: string): boolean {
    return (
        origin.startsWith("chrome-extension://") ||
        origin.startsWith("brave-extension://") ||
        origin.startsWith("moz-extension://")
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isHandshakeMessage(
    payload: Record<string, unknown>,
): payload is HandshakeMessage {
    return (
        payload.type === "handshake" &&
        typeof payload.clientId === "string" &&
        typeof payload.browserType === "string" &&
        typeof payload.extensionVersion === "string"
    );
}

function isEventEnvelope(
    payload: Record<string, unknown>,
): payload is EventEnvelope {
    return (
        typeof payload.entryId === "string" && typeof payload.event === "string"
    );
}

process.stdin.on("data", (data) => {
    try {
        const { action, clientId, command } = JSON.parse(data.toString()) as {
            action: string;
            clientId: string;
            command: DesktopCommand;
        };

        if (action === "send_to_client") {
            const ws = registry.get(clientId);
            if (ws?.readyState === WebSocket.OPEN) {
                ws?.send(JSON.stringify(command));
            }
        }
    } catch (error) { }
});

startServer().catch((error) => {
    console.error("[SIDECAR ERROR]", error);
    process.exit(1);
});
