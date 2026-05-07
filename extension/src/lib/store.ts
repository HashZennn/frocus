import { RULES_KEY, SESSION_KEY, type Rule } from "./types";

export async function loadRules(): Promise<Array<Rule> | null> {
    const data = await chrome.storage.local.get(RULES_KEY)

    return (data[RULES_KEY] as Array<Rule> | undefined) ?? null
}

export async function saveRules(rules: Array<Rule>): Promise<void> {
    await chrome.storage.local.set({ [RULES_KEY]: rules })
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