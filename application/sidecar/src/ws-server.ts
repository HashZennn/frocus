import { PrismaClient } from "@prisma/client/extension";
import * as http from "http"
import { WebSocketServer } from "ws";

const PORT_RANGE_START = 7423;
const PORT_RANGE_END = 7433;
const MAX_MESSAGE_BYTES = 256 * 1024;
const ALLOWED_ORIGIN =
    process.env.FROCUS_EXTENSION_ORIGIN ||
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

const registry = new Map<string, WebSocket>()
const prisma = new PrismaClient()

async function startServer() {
    await prisma.$connect().catch(console.error)

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

startServer()