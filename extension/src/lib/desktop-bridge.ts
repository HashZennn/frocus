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

async function getOrCreateClientId(): Promise<string> {
    const stored = await chrome.storage.local.get(CLIENT_ID_KEY)
    const existing = stored[CLIENT_ID_KEY] as string | null

    if (existing) return existing

    const id = crypto.randomUUID()

    await chrome.storage.local.set({ [CLIENT_ID_KEY]: id })

    return id
}

class DesktopBridgeClient {
    private clientId: string | null = null
    private readonly browserType = detectBrowser()

    constructor() {
        this.boot()
    }

    private async boot(): Promise<void> {
        this.clientId = await getOrCreateClientId()
    }

    async send(event: FrocusEvent) {
        console.log("Event: ", event)
    }

    getClientId(): string | null {
        return this.clientId
    }

    getBrowserType(): BrowserType {
        return this.browserType
    }
}

export const desktopBridge = new DesktopBridgeClient()