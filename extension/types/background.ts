export type RuleType = "exact" | "path" | "regex" | "group"

export type Rule = {
    id: string;
    type: RuleType;
    match: string | Array<string>;
    trackTitle?: boolean;
    trackMeta?: boolean;
    include?: Array<string>
}

export type LiveRule = {
    id: string;
    type: RuleType;
    match: string | Array<string>;
    regex?: RegExp;
    include: Array<string>;
    needsMeta: boolean;
}

export type PageMeta = {
    title?: string;
    description?: string;
    keywords?: Array<string>;
    matchedTerms?: Array<string>;
}

export type Session = {
    ruleIds: Array<string>;
    primaryRule: string;
    tabId: number;
    startedAt: number;
    meta?: PageMeta;
}

export type ParsedUrl = {
    hostname: string;
    pathname: string;
    full: string;
}