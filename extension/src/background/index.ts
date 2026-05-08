import { Storage } from "@plasmohq/storage"
import { compileRules } from "~lib/compiler";
import { DEFAULT_RULES } from "~lib/rules";
import { loadPersistedSession, loadRules, persistSession, saveRules, type PersistedSession } from "~lib/store";
import { FLUSH_ALARM, FLUSH_PERIOD_MIN, RULES_KEY, type LiveRule, type PageMeta, type Rule, type Session } from "~lib/types";

class FrocusTracker {
    private rules: Array<LiveRule> = []

    private session: Session | null = null

    private metaCache = new Map<number, PageMeta>()

    private timeAcc: Record<string, number> = {}
    private metaAcc: Record<string, Array<PageMeta>> = {}

    private isFocused = true
    private switchDebounce: ReturnType<typeof setTimeout> | null = null

    private readonly storage = new Storage({ area: "local" })

    constructor() {
        this.attachListeners()
        this.init()
    }

    private async init() {
        const stored = await loadRules()
        if (!stored) await saveRules(DEFAULT_RULES)
        this.rules = compileRules(stored ?? DEFAULT_RULES)

        const orphan = await loadPersistedSession()
        if (orphan) this.recoverOrphanedSession(orphan)

        // const existing = await chrome.alarms.get(FLUSH_ALARM)
        // if (!existing) {
        //     chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN })
        // }

        this.storage.watch({
            [RULES_KEY]: ({ newValue }) => {
                this.rules = compileRules((newValue as Array<Rule>) ?? DEFAULT_RULES)
                console.log("Rules reloaded: ", this.rules.length)
            }
        })

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            // if (tab?.id) this.scheduleSwitch(tab.id) // TODO: add scheduleSwitch
        } catch (error) {
            
        }

        console.log("Frocus Tracker is ready. Rules: ", this.rules)
    }

    private attachListeners(): void {

    }

    private async handleFocusChange(windowId: number): Promise<void> {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            this.isFocused = false
            // TODO: endSession()

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

            if (tab.id) {
                // TDOD: ScheduleSwitch tab
            }
        } catch (error) {
            
        }

    }

    


    receivePageMeta(tabId: number, meta: PageMeta, url: string): void {
        console.log("TabId: ", tabId, " Meta: ", meta, " Url: ", url)
    }

    private recoverOrphanedSession(orphan: PersistedSession): void {
        const duration = Date.now() - orphan.startedAt

        if (duration <= 0) return

        console.log(`Recovering orphaned session: ${orphan.ruleIds} - ${duration}ms`)

        for (const id of orphan.ruleIds) {
            this.timeAcc[id] = (this.timeAcc[id] ?? 0) + duration
        }

        persistSession(null)
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

    updateRules(rules: Array<Rule>): void {
        saveRules(rules)
        // console.log("RULES: ", rules)
    }


}

export const tracker = new FrocusTracker()