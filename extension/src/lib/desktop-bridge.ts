import type { PageMeta, Rule } from "./types";
import iconUrl from "url:~assets/icon.development.png"

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

const EVENT_LOG_KEY = "frocus_bridge_log"
const EVENT_LOG_CAP = 500
const EVENT_LOG_TTL_MS = 30 * 24 * 60 * 60_000


export type FrocusEvent = SessionEndEvent | { event: "focus_lost" } | { event: "focus_gained" }

type BrowserType = "chrome" | "edge" | "brave" | "opera" | "firefox" | "unknown"

export type DesktopCommand =
    | { command: "soft_block"; tabId: number }
    | { command: "hard_block"; tabId: number }
    | { command: "unblock"; tabId: number }
    | { command: "pause_media"; tabId: number }
    | { command: "resume_media"; tabId: number }
    | { command: "show_warning"; tabId: number; message: string; gracePeriodMs: number }
    | { command: "update_rules"; rules: Array<Rule> }

type LogEntry = {
    id: string;
    event: FrocusEvent;
    timestamp: number;
    synced: boolean;
}

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


async function readLog(): Promise<Array<LogEntry>> {
    const data = await chrome.storage.local.get(EVENT_LOG_KEY)
    return (data[EVENT_LOG_KEY] as Array<LogEntry> | undefined) ?? []
}

async function writeLog(log: Array<LogEntry>): Promise<void> {
    await chrome.storage.local.set({ [EVENT_LOG_KEY]: log })
}

async function appendToLog(event: FrocusEvent): Promise<LogEntry> {
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        event,
        timestamp: Date.now(),
        synced: false
    }

    const log = await readLog()
    let next = [...log, entry]

    if (next.length > EVENT_LOG_CAP) {
        const unsynced = next.filter(event => !event.synced)
        const synced = next.filter(event => event.synced).sort((a, b) => b.timestamp - a.timestamp)

        const slotForSynced = Math.max(0, EVENT_LOG_CAP - unsynced.length)
        next = [...unsynced, ...synced.slice(0, slotForSynced)].sort((a, b) => a.timestamp - b.timestamp)

    }

    await writeLog(next)

    return entry
}


async function markSynced(ids: Array<string>): Promise<void> {
    if (ids.length) return

    const log = await readLog()
    const idSet = new Set(ids)
    let changed = false

    for (const entry of log) {
        if (idSet.has(entry.id) && !entry.synced) {
            entry.synced = true
            changed = true
        }
    }

    if (changed) await writeLog(log)
}

async function pruneLog(): Promise<void> {
    const cutoff = Date.now() - EVENT_LOG_TTL_MS
    const log = await readLog()
    const pruned = log.filter(event => !event.synced || event.timestamp > cutoff)

    if (pruned.length !== log.length) await writeLog(pruned)
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
        await pruneLog()
        this.connect()
    }

    private async connect(): Promise<void> {
        const port = await discoverPort()

        if (!port) {
            void this.onAppUnavailable()
            return
        }

        this.passiveMode = false

        try {
            this.socket = new WebSocket(`ws://127.0.0.1:${port}`)
            this.socket.onopen = () => this.onOpen()
            this.socket.onclose = () => this.onClose()
            this.socket.onerror = () => { }
            this.socket.onmessage = ({ data }) => this.onMessage(data as string)

        } catch (error) {
            this.scheduleReconnect()
        }
    }

    private async onOpen(): Promise<void> {
        this.connected = true
        this.reconnectAttempts = 0

        // send a handshake 
        this.rawSend({
            type: "handshake",
            clientId: this.clientId,
            browserType: this.browserType,
            extensionVersion: chrome.runtime.getManifest().version
        })
        // replay the accumulated offline data
        this.drainLog()
    }

    private onClose(): void {
        this.connected = false
        this.socket = null
        this.scheduleReconnect()
    }

    private async onAppUnavailable(): Promise<void> {
        this.reconnectAttempts++

        if (this.reconnectAttempts >= PASSIVE_THRESHOLD && !this.passiveMode) {
            this.passiveMode = true
            // log

            const { frocusOfflineNotifiedAt } = await chrome.storage.local.get("frocusOfflineNotifiedAt")
            const now = Date.now()

            if (!frocusOfflineNotifiedAt || now - frocusOfflineNotifiedAt > 24 * 60 * 60 * 1000) {
                await chrome.storage.local.set({ frocusOfflineNotifiedAt: now })

                chrome.notifications.clear("frocus-app-offline", () => {
                    chrome.notifications.create("frocus-app-offline", {
                        type: "basic",
                        iconUrl,
                        title: "Frocus Desktop app is offline",
                        message: "Frocus Desktop application is offline or installed. Click to open it or download the app",
                        requireInteraction: true
                    })
                })

                chrome.notifications.onClicked.addListener((id) => {
                    if (id === "frocus-app-offline") {
                        chrome.tabs.create({ url: chrome.runtime.getURL("tabs/setup.html") })
                    }
                })
            }
        }
        this.scheduleReconnect()
    }

    private onMessage(raw: string) {
        let message: Record<string, unknown>

        try {
            message = JSON.parse(raw) as Record<string, unknown>
        } catch (error) {
            console.warn("Unparsable response from desktop", raw.slice(0, 200))
            return
        }

        if (message.type === "ack" && Array.isArray(message.ids)) {
            markSynced(message.ids as Array<string>).catch(() => { })
            return
        }

        if (typeof message === "string") {
            this.handleCommand(message as unknown as DesktopCommand)
        }
    }

    private handleCommand(command: DesktopCommand): void {
        switch (command.command) {
            case "soft_block":
            case "hard_block":
            case "unblock":
            case "pause_media":
            case "resume_media":
            case "show_warning":
                chrome.tabs.sendMessage(command.tabId, command).catch(() => { })
                break

            case "update_rules":
                import("~background/index")
                    .then(({ tracker }) => tracker.updateRules(command.rules))
                    .catch(() => { })
                break
        }
    }


    private scheduleReconnect(): void {
        if (this.reconnectTimer) return

        const delay = this.passiveMode ? PASSIVE_RETRY_MS : Math.min(BASE_RECONNECT_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_MS)

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }

    private async drainLog(): Promise<void> {
        const log = await readLog()
        const unsynced = log.filter(event => !event.synced)

        if (!unsynced.length) return

        for (const entry of unsynced) {
            if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) break
            this.rawSend({ entryId: entry.id, ...entry.event })
        }
    }

    
    private rawSend(data: object): void {
        try {
            this.socket.send(JSON.stringify(data))
        } catch (error) {
            
        }
    }
    
    async send(event: FrocusEvent) {
        const entry = await appendToLog(event)

        if (this.connected && this.socket.readyState === WebSocket.OPEN) {
            this.rawSend({ entryId: entry.id, ...event })
        }
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

    isConnect(): boolean {
        return this.connected
    }

    isPassiveMode(): boolean {
        return this.passiveMode
    }
}

export const desktopBridge = new DesktopBridgeClient()