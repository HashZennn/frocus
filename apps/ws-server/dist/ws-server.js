"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const schema_1 = require("./schema");
const http = __importStar(require("http"));
const ws_1 = require("ws");
const PORT_RANGE_START = 7423;
const PORT_RANGE_END = 7433;
const MAX_MESSAGE_BYTES = 256 * 1024;
const ALLOWED_ORIGIN = process.env.FROCUS_EXTENSION_ORIGIN ||
    "brave://extensions/?id=fbihhjcmfoikfgflklihoacmfdfaloak";
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
const registry = new Map();
async function startServer() {
    const server = http.createServer();
    let port = PORT_RANGE_START;
    while (port <= PORT_RANGE_END) {
        try {
            await new Promise((resolve, reject) => server
                .listen(port, "127.0.0.1")
                .once("listening", resolve)
                .once("error", reject));
            break;
        }
        catch (error) {
            port++;
        }
    }
    sendToTauri("frocus://ws_port", port);
    const webSocketServer = new ws_1.WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
        if (request.headers.origin !== ALLOWED_ORIGIN && !(process.env.NODE_ENV === "development")) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            return socket.destroy();
        }
        webSocketServer.handleUpgrade(request, socket, head, (websocket) => {
            webSocketServer.emit("connection", websocket);
        });
    });
    webSocketServer.on("connection", (websocket) => {
        let clientId = "";
        let pendingAcknowledgements = [];
        websocket.on("message", async (data, isBinary) => {
            if (isBinary && data.byteLength >= MAX_MESSAGE_BYTES)
                return;
            const payload = JSON.parse(data.toString("utf-8"));
            if (!clientId) {
                clientId = payload.clientId;
                registry.set(clientId, websocket);
                sendToTauri("frocus://browser_connected", payload);
                return;
            }
            pendingAcknowledgements.push(payload.entryId);
            await onEvent(payload, clientId);
            if (pendingAcknowledgements.length >= 10 || payload.event === "session_end" || payload.event === "rule_violation" || payload.event === "system_event") {
                websocket.send(JSON.stringify({ type: "ack", ids: pendingAcknowledgements }));
                pendingAcknowledgements = [];
            }
        });
        websocket.on("close", () => {
            if (pendingAcknowledgements.length) {
                websocket.send(JSON.stringify({ type: "ack", ids: pendingAcknowledgements }));
            }
            registry.delete(clientId);
            sendToTauri("frocus://browser_disconnected", clientId);
        });
    });
}
async function onEvent(envelope, clientId) {
    if (envelope.event === "session_end") {
        await db_1.db.insert(schema_1.sessions).values({
            id: crypto.randomUUID(),
            clientId,
            browserType: envelope.browserType || "unknown",
            url: envelope.url,
            hostname: envelope.hostname,
            pathname: envelope.pathname,
            meta: envelope.meta,
            durationMs: envelope.durationMs,
            startedAt: new Date(envelope.startedAt),
            endedAt: new Date(envelope.endAt),
            matchedRules: JSON.stringify(envelope.ruleIds || []),
            primaryRuleId: envelope.primaryRuleId
        }).catch((error) => console.error("[SIDECAR] Session DB Error: ", error));
        sendToTauri("frocus://session_end", { clientId, event: envelope });
    }
    else if (envelope.event === "page_meta_scanned") {
        sendToTauri("frocus://page_meta_scanned", {
            clientId,
            meta: envelope.meta,
            url: envelope.url
        });
    }
    else {
        sendToTauri(`frocus://${envelope.event}`, {
            clientId,
            ...envelope
        });
    }
}
function sendToTauri(eventName, payload) {
    process.stdout.write(JSON.stringify({ event: eventName, payload }) + "\n");
}
process.stdin.on("data", (data) => {
    try {
        const { action, clientId, command } = JSON.parse(data.toString());
        if (action === "send_to_client") {
            const ws = registry.get(clientId);
            if (ws?.readyState === ws_1.WebSocket.OPEN) {
                ws?.send(JSON.stringify(command));
            }
        }
    }
    catch (error) {
    }
});
startServer().catch((error) => {
    console.error("[SIDECAR ERROR]", error);
    process.exit(1);
});
