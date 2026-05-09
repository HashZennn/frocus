import { Storage } from "@plasmohq/storage"
import { compileRules, matchRules, parseUrl } from "~lib/compiler";
import { resolveRules } from "~lib/resolver";
import { DEFAULT_RULES } from "~lib/rules";
import { flushHostnameTime, flushMeta, flushTime, loadPersistedSession, loadRules, persistSession, saveRules } from "~lib/store";
import type { PersistedSession } from "~lib/store";
import { FLUSH_ALARM, FLUSH_PERIOD_MIN, RULES_KEY, SWITCH_DEBOUNCE_MS } from "~lib/types";
import type { LiveRule, PageMeta, RequestMetaMessage, Rule, Session } from "~lib/types";

class FrocusTracker {
    private rules: Array<LiveRule> = []

    private session: Session | null = null

    private metaCache = new Map<number, PageMeta>()

    private timeAcc: Record<string, number> = {}
    private metaAcc: Record<string, Array<PageMeta>> = {}
    private hostnameTimeAcc: Record<string, number> = {}

    private isFocused = true
    private activeTabId: number | null = null
    private switchDebounceTimer: ReturnType<typeof setTimeout> | null = null
    private pendingSwitchAt: number | null = null

    private readonly storage = new Storage({ area: "local" })

    constructor() {
        this.attachListeners()
        this.init()
    }

    private async init() {
        const stored = await loadRules()
        if (!stored) await saveRules(DEFAULT_RULES)
        this.rules = compileRules(stored ?? DEFAULT_RULES)

        const all = (await chrome.storage.local.get()) as Record<string, unknown>
        const namedRuleIds = new Set(
            (stored ?? DEFAULT_RULES)
                .filter((rule) => rule.behavior?.emit !== "fallback")
                .map((rule) => rule.id)
        )
        
        const keysToRemove = Object.keys(all).filter((key) => {
            if (!key.startsWith("frocus_htime_")) return false
            const ruleId = key.slice("frocus_htime_".length).split("::")[0]
            return namedRuleIds.has(ruleId)
        })

        if (keysToRemove.length) await chrome.storage.local.remove(keysToRemove)

        const orphan = await loadPersistedSession()
        if (orphan) this.recoverOrphanedSession(orphan)

        const existing = await chrome.alarms.get(FLUSH_ALARM)

        if (!existing) {
            chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN })
        }

        this.storage.watch({
            [RULES_KEY]: ({ newValue }) => {
                this.rules = compileRules((newValue as Array<Rule>) ?? DEFAULT_RULES)
            }
        })

        try {
            const window = await chrome.windows.getLastFocused()
            this.isFocused = window.focused

            if (!this.isFocused) return

            const [tab] = await chrome.tabs.query({
                active: true,
                lastFocusedWindow: true
            })

            if (tab?.id) {
                this.activeTabId = tab.id
                this.scheduleSwitch(tab.id)
            }
        } catch (error) { }
    }

    private attachListeners(): void {
        chrome.tabs.onActivated.addListener(({ tabId }) => {
            this.activeTabId = tabId
            this.scheduleSwitch(tabId)
        })

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (tabId !== this.activeTabId && !tab.active) return

            const shouldSwitch =
                changeInfo.status === "complete" ||
                Boolean(changeInfo.url) ||
                Boolean(changeInfo.title)

            if (!shouldSwitch) return

            this.scheduleSwitch(tabId)
        })

        chrome.tabs.onRemoved.addListener((tabId) => {
            if (this.session?.tabId === tabId) this.endSession()
            this.metaCache.delete(tabId)
        })

        chrome.windows.onFocusChanged.addListener((windowId) =>
            this.handleFocusChange(windowId)
        )

        chrome.alarms.onAlarm.addListener(({ name }) => {
            if (name === FLUSH_ALARM) this.flush()
        })
    }

    private async handleFocusChange(windowId: number): Promise<void> {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            try {
                const windows = await chrome.windows.getAll({ populate: false })
                if (windows.some((window) => window.focused)) return
            } catch (e) { }

            this.isFocused = false

            if (this.switchDebounceTimer) clearTimeout(this.switchDebounceTimer)
            this.switchDebounceTimer = null

            this.scheduleSwitch()

            // TODO: send notification to desktop app (focus_lost)
            // TODO: detect idle state

            return
        }

        this.isFocused = true

        // TODO: send notification to desktop app (focus_gained)

        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                windowId
            })

            if (tab?.id) {
                this.activeTabId = tab.id
                this.scheduleSwitch(tab.id)
            }
        } catch (error) { }
    }

    private scheduleSwitch(targetTabId?: number): void {
        if (!this.pendingSwitchAt) this.pendingSwitchAt = Date.now()
        if (this.switchDebounceTimer) clearTimeout(this.switchDebounceTimer)

        this.switchDebounceTimer = setTimeout(async () => {
            this.switchDebounceTimer = null

            try {
                const windows = await chrome.windows.getAll({ populate: false })
                this.isFocused = windows.some((window) => window.focused)
            } catch (e) { }

            this.switchSession(targetTabId ?? this.activeTabId)
        }, SWITCH_DEBOUNCE_MS)
    }

    private async switchSession(targetTabId: number | null): Promise<void> {
        const switchAt = this.pendingSwitchAt ?? Date.now()
        this.pendingSwitchAt = null

        if (!this.isFocused || !targetTabId) {
            this.endSession(switchAt)
            return
        }

        try {
            const tab = await chrome.tabs.get(targetTabId)
            if (!tab) return

            const rawUrl = tab.url || tab.pendingUrl
            if (!rawUrl || !tab.id) return

            const tabId = tab.id

            const url = parseUrl(rawUrl)
            if (!url) {
                this.endSession(switchAt)
                return
            }

            const isSameMatch =
                this.session?.tabId === tabId &&
                this.session?.hostname === url.hostname &&
                this.session?.pathname === url.pathname

            const allMatched = matchRules(url, this.rules)
            const ruleMap = new Map(this.rules.map((rule) => [rule.id, rule]))
            const matchedIds = resolveRules(allMatched, this.rules)

            if (isSameMatch) {
                if (matchedIds.length && ruleMap.get(matchedIds[0])?.needsMeta) {

                    this.resolveSessionMeta(tab.id, ruleMap.get(matchedIds[0])!)
                        .then((meta) => {
                            if (meta && this.session) this.session.meta = meta
                        })
                        .catch(() => { })
                }
                return
            }

            if (!matchedIds.length) {
                this.endSession(switchAt)
                return
            }

            this.endSession(switchAt)

            const primaryRuleId = matchedIds[0]

            this.session = {
                ruleIds: matchedIds,
                primaryRuleId,
                tabId,
                startedAt: switchAt,
                hostname: url.hostname,
                pathname: url.pathname
            }

            await persistSession({
                ruleIds: this.session?.ruleIds,
                primaryRuleId: this.session?.primaryRuleId,
                tabId: this.session?.tabId,
                startedAt: this.session?.startedAt,
                hostname: this.session.hostname,
                pathname: this.session.pathname
            })

            const primaryRule = ruleMap.get(primaryRuleId)

            if (primaryRule.needsMeta) {
                const meta = await this.resolveSessionMeta(tab.id, primaryRule)

                if (meta && this.session?.primaryRuleId === primaryRuleId) this.session.meta = meta
            }

            console.log("Session start: ", this.session)

            // TODO: send notification to desktop app (session_start)
        } catch (error) { }
    }

    private endSession(endAt?: number): void {
        if (!this.session) return

        const endTime = endAt ?? Date.now()
        const duration = Math.max(0, endTime - this.session?.startedAt)

        if (duration > 0) {
            for (const id of this.session?.ruleIds) {
                this.timeAcc[id] = (this.timeAcc[id] ?? 0) + duration
            }

            const primaryRule = this.rules.find((rule) => rule.id === this.session.primaryRuleId)

            if (this.session.hostname && primaryRule?.behavior.trackHostnames) {
                const hostnameKey = `${this.session.primaryRuleId}::${this.session.hostname}`
                this.hostnameTimeAcc[hostnameKey] =
                    (this.hostnameTimeAcc[hostnameKey] ?? 0) + duration
            }

            if (this.session.meta) {
                const id = this.session.primaryRuleId;
                (this.metaAcc[id] ??= []).push(this.session.meta)
            }
        }

        console.log(`Session end: ${duration}ms > [${this.session?.ruleIds.join(", ")}]`)

        // TODO: send notification to desktop app (session_end)

        persistSession(null)

        this.session = null

        this.flush()
    }

    private async resolveSessionMeta(tabId: number, rule: LiveRule): Promise<PageMeta | null> {
        const cached = this.metaCache.get(tabId)

        if (cached) return cached

        try {
            const message: RequestMetaMessage = {
                type: "REQUEST_META",
                metaFields: rule.metaFields,
                includeTerms: rule.include
            }

            const meta = (await chrome.tabs.sendMessage(tabId, message)) as PageMeta | undefined

            if (meta) {
                this.metaCache.set(tabId, meta)
                return meta
            }

        } catch (error) { }

        return null
    }

    receivePageMeta(tabId: number, meta: PageMeta, url: string): void {

        this.metaCache.set(tabId, meta)

        if (this.session?.tabId === tabId && this.session?.primaryRuleId && !this.session?.meta) {
            chrome.tabs.get(tabId)
                .then((tab) => {
                    if (tab.url === url && this.session?.tabId === tabId) {
                        const rule = this.rules.find(
                            (rule) => rule.id === this.session?.primaryRuleId
                        )

                        if (rule.needsMeta) this.session.meta = meta
                    }
                })
                .catch(() => { })
        }

        // console.log("TabId: ", tabId, " Meta: ", meta, " Url: ", url)
    }

    private recoverOrphanedSession(orphan: PersistedSession): void {
        const duration = Date.now() - orphan.startedAt

        if (duration <= 0) return

        console.log(`Recovering orphaned session: ${orphan.ruleIds} - ${duration}ms`)

        for (const id of orphan.ruleIds) this.timeAcc[id] = (this.timeAcc[id] ?? 0) + duration

        persistSession(null)
    }

    private async flush(): Promise<void> {

        const hasTime = Object.keys(this.timeAcc).length > 0
        const hasMeta = Object.keys(this.metaAcc).length > 0
        const hasHostname = Object.keys(this.hostnameTimeAcc).length > 0

        if (!hasMeta && !hasTime && !hasHostname) return

        const timeSnap = this.timeAcc
        const metaSnap = this.metaAcc
        const hostnameSnap = this.hostnameTimeAcc

        this.timeAcc = {}
        this.metaAcc = {}
        this.hostnameTimeAcc = {}

        try {
            await Promise.all([
                hasTime ? flushTime(timeSnap) : Promise.resolve(),
                hasMeta ? flushMeta(metaSnap) : Promise.resolve(),
                hasHostname ? flushHostnameTime(hostnameSnap) : Promise.resolve()
            ])

            console.log("Flush done: ", Object.keys(timeSnap))
        } catch (error) {
            console.warn("Flush failed. Restoring accumuators: ", error)

            for (const [id, ms] of Object.entries(timeSnap)) this.timeAcc[id] = (this.timeAcc[id] ?? 0) + ms

            for (const [id, metas] of Object.entries(metaSnap)) (this.metaAcc[id] ??= []).push(...metas)

            for (const [key, ms] of Object.entries(hostnameSnap)) this.hostnameTimeAcc[key] = (this.hostnameTimeAcc[key] ?? 0) + ms

        }
    }

    getSession() {
        return this.session
    }

    getRules() {
        return this.rules
    }

    getTimeAccumulator() {
        return {
            ...this.timeAcc
        }
    }

    getHostnameTimeAccumulator() {
        return { ...this.hostnameTimeAcc }
    }

    updateRules(rules: Array<Rule>): void {
        saveRules(rules)
        // console.log("RULES: ", rules)
    }
}

export const tracker = new FrocusTracker()
