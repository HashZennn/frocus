import { META_KEY, RULES_KEY, SESSION_KEY, TIME_KEY, type PageMeta, type Rule } from "./types";

export async function loadRules(): Promise<Array<Rule> | null> {
    const data = await chrome.storage.local.get(RULES_KEY)

    return (data[RULES_KEY] as Array<Rule> | undefined) ?? null
}

export async function saveRules(rules: Array<Rule>): Promise<void> {
    await chrome.storage.local.set({ [RULES_KEY]: rules })
}

export async function flushTime(deltas: Record<string, number>): Promise<void> {
    const ids = Object.keys(deltas)

    if (!ids.length) return

    const keys = ids.map(TIME_KEY)
    const current = await chrome.storage.local.get(keys)

    const updates: Record<string, number> = {}

    for (const id of ids) {
        updates[TIME_KEY(id)] = ((current[TIME_KEY(id)] as number | undefined) ?? 0) + deltas[id]
    }

    await chrome.storage.local.set(updates)
}

const META_CAP = 500

export async function flushMeta(entries: Record<string, Array<PageMeta>>): Promise<void> {
    const ids = Object.keys(entries)

    if (!ids.length) return

    const keys = ids.map(META_KEY)
    const current = await chrome.storage.local.get(keys)

    const updates: Record<string, Array<PageMeta>> = {}

    for (const id of ids) {
        const prev = (current[META_KEY(id)] as Array<PageMeta> | undefined) ?? []
        const merged = [...prev, ...entries[id]]
        updates[META_KEY(id)] = merged.length > META_CAP ? merged.slice(-META_CAP) : merged
    }

    await chrome.storage.local.set(updates)
}

export type PersistedSession = {
    ruleIds: Array<string>;
    primaryRuleId: string;
    tabId: number;
    startedAt: number;
}

export async function persistSession(session: PersistedSession | null): Promise<void> {
    if (session === null) {
        await chrome.storage.local.remove(SESSION_KEY)
    } else {
        await chrome.storage.local.set({
            [SESSION_KEY]: session
        })
    }
}

export async function loadPersistedSession(): Promise<PersistedSession | null> {
    const data = await chrome.storage.local.get(SESSION_KEY)

    return (data[SESSION_KEY] as PersistedSession | undefined) ?? null
}