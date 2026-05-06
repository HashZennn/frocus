import { Storage } from "@plasmohq/storage"
import type { LiveRule, PageMeta, Session } from "~lib/types";

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
        console.log("RUNNING THE INDEX FILE")
    }



    receivePageMeta(tabId: number, meta: PageMeta, url: string): void {
        console.log("TabId: ", tabId, " Meta: ", meta, " Url: ", url)
    }


}

export const tracker = new FrocusTracker()