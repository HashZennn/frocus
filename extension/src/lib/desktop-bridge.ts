import type { PageMeta } from "./types";

export type SessionEndEvent = {
    event: "session_end";
    clientId: string;
    browserType: BrowserType;
    ruleIds: Array<string>;
    primaryRuleId: string;
    category: string;
    url: string;
    hostname: string;
    pathname: string;
    meta: PageMeta;
    startedAt: number;
    endAt: number;
    durationMs: number;
    tabId: number;
}

const PORT_RANGE_START = 7423
const PORT_RANGE_END = 7433
const PORT_PROBE_TIMEOUT_MS = 400
const PORT_CACHE_KEY = "frocus_ws_port"

const BASE_RECONNECT_MS = 1_000
const MAX_RECONNECT_MS = 30_000
const PASSIVE_THRESHOLD = 10
const PASSIVE_RETRY_MS = 5 * 60_000
const CLIENT_ID_KEY = "frocus_client_id"

export type FrocusEvent = SessionEndEvent | { event: "focus_lost" } | { event: "focus_gained" }

type BrowserType = "chrome" | "edge" | "brave" | "opera" | "firefox" | "unknown"

function detectBrowser(): BrowserType {
    const userAgent = navigator.userAgent
    if (userAgent.includes("Edg/")) return "edge"
    if (userAgent.includes("OPR/")) return "opera"
    if (userAgent.includes("Brave")) return "brave"
    if (userAgent.includes("Firefox")) return "firefox"
    if (userAgent.includes("Chrome")) return "chrome"
    return "unknown"
}

async function discoverPort(): Promise<number | null> {
    const stored = await chrome.storage.local.get(PORT_CACHE_KEY)
    const cached = stored[PORT_CACHE_KEY] as number | undefined

    if (cached && (await probePort(cached))) return cached

    for (let port = PORT_RANGE_START; port < PORT_RANGE_END; port++) {
        if (port === cached) continue
        
        if (await probePort(port)) {
            await chrome.storage.local.set({ [PORT_CACHE_KEY]: port })
            return port
        }
    }

    return null
}

function probePort(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`)

        const timer = setTimeout(() => {
            socket.close()
            resolve(false)
        }, PORT_PROBE_TIMEOUT_MS)

        socket.onopen = () => {
            clearTimeout(timer)
            socket.close()
            resolve(true)
        }

        socket.onerror = () => {
            clearTimeout(timer)
            resolve(false)
        }
    })
}

async function getOrCreateClientId(): Promise<string> {
    const stored = await chrome.storage.local.get(CLIENT_ID_KEY)
    const existing = stored[CLIENT_ID_KEY] as string | null

    if (existing) return existing

    const id = crypto.randomUUID()

    await chrome.storage.local.set({ [CLIENT_ID_KEY]: id })

    return id
}

class DesktopBridgeClient {
    private socket: WebSocket | null = null
    private connected = false

    private clientId: string | null = null
    private readonly browserType = detectBrowser()

    private reconnectAttempts = 0
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private passiveMode = false

    constructor() {
        this.boot()
    }

    private async boot(): Promise<void> {
        this.clientId = await getOrCreateClientId()
        this.connect()
    }

    private async connect(): Promise<void> {
        const port = await discoverPort()

        if (!port) {
            // unavailable
            return
        }

        this.passiveMode = false

        try {
            this.socket = new WebSocket(`ws://127.0.0.1:${port}`)
            this.socket.onopen = () => this.onOpen()
            this.socket.onclose = () => this.onClose()
            this.socket.onerror = () => {}
            this.socket.onmessage = ({ data }) => this.onMessage(data as string)

        } catch (error) {
            this.scheduleReconnect()
        }
    }   

    private async onOpen(): Promise<void> {
        this.connected = true
        this.reconnectAttempts = 0

        // send a handshake 
        // replay the accumulated offline data
    }

    private onClose(): void {
        this.connected = false
        this.socket = null
        this.scheduleReconnect()
    }

    private onMessage(data: string) {

    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return

        const delay = this.passiveMode ? PASSIVE_RETRY_MS : Math.min(BASE_RECONNECT_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_MS)

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }

    async send(event: FrocusEvent) {
        console.log("Event: ", event)
    }

    ensureConnect() {
        if (!this.connected && !this.reconnectTimer) this.connect()
    }

    getClientId(): string | null {
        return this.clientId
    }

    getBrowserType(): BrowserType {
        return this.browserType
    }
}

export const desktopBridge = new DesktopBridgeClient()