import { Storage } from "@plasmohq/storage"

export {}

export type RuleType = "exact" | "path" | "regex" | "group"

export type Rule = {
    id: string;
    type: RuleType;
    match: string | Array<string>;
    trackTitle?: boolean;
    trackMeta?: boolean;
    include?: Array<string>
}

type LiveRule = {
    id: string;
    type: RuleType;
    match: string | Array<string>;
    regex?: RegExp;
    include: Array<string>;
    needsMeta: boolean;
}

type PageMeta = {
    title?: string;
    description?: string;
    keywords?: Array<string>;
    matchedTerms?: Array<string>;
}

type Session = {
    ruleIds: Array<string>;
    primaryRule: string;
    tabId: number;
    startedAt: number;
    meta?: PageMeta;
}

type ParsedUrl = {
    hostname: string;
    pathname: string;
    full: string;
}

export const RULES_STORAGE_KEY = "frocus_rules"
const FLUSH_INTERVAL_IN_MS = 5_000
const SWITCH_DEBOUNCE_IN_MS = 150


class FrocusTracker {
    private storage = new Storage()
    
}

new FrocusTracker()