import { Storage } from "@plasmohq/storage"
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
        // attach the chrome listners, and init
    }

    private async init() {
        const stored = await loadRules()
        if (!stored) await saveRules(DEFAULT_RULES)

        const orphan = await loadPersistedSession()

        const existing = await chrome.alarms.get(FLUSH_ALARM)
        if (!existing) {
            chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN })
        }

        this.storage.watch({
            [RULES_KEY]: ({ newValue }) => {
                
            }
        })
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