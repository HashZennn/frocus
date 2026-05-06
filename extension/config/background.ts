import type { Rule } from "../types/background";

export const RULES_STORAGE_KEY = "frocus_rules"
export const FLUSH_INTERVAL_IN_MS = 5_000
export const SWITCH_DEBOUNCE_IN_MS = 150

export const DEFAULT_RULES: Array<Rule> = [
    {
        id: "youtube_shorts",
        type: "path", 
        match: "youtube.com/shorts",
        trackTitle: true,
    },
    {
        id: "youtube",
        type: "exact",
        match: "youtube.com"
    },
    {
        id: "dopamine_intox",
        type: "group",
        match: ["instagram.com", "tiktok.com", "youtube.com"]
    },
]