import { Storage } from "@plasmohq/storage"
import { compileRules } from "~lib/compiler";
import { DEFAULT_RULES } from "~lib/rules";
import { loadPersistedSession, loadRules, saveRules } from "~lib/store";
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
        // if (orphan) this.recoverOrphanedSession(orphan) // TODO: add recoverOrphanedSession

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


    receivePageMeta(tabId: number, meta: PageMeta, url: string): void {
        console.log("TabId: ", tabId, " Meta: ", meta, " Url: ", url)
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