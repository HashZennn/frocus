import type { Rule } from "~types";

export const RULES_STORAGE_KEY = "frocus_rules"
export const FLUSH_INTERVAL_IN_MS = 5_000
export const SWITCH_DEBOUNCE_IN_MS = 150

export const DEFAULT_RULES: Array<Rule> = [
    {
        id: "youtube_shorts",
        match: { hostname: "youtube.com", pathname: "/shorts" },
        meta: ["title", "description", "keywords", "og:image"],
        include: ["trending", "viral", "shorts"]
    },
    {
        id: "youtube",
        match: { hostname: "youtube.com" },
        groupOnly: true
    },
    {
        id: "instagram",
        match: { hostname: "instagram.com" },
        groupOnly: true
    },
    {
        id: "dopamine_intox",
        match: [
            { ref: "instagram" },
            { ref: "youtube" }
        ]
    },
]