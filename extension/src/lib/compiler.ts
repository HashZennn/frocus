import type { LiveRule, Rule } from "./types";


export function compileRules(rawRules: Array<Rule>): Array<LiveRule> {
    const index = new Map(rawRules.map(rule => [rule.id, rule]))

    return rawRules.map(rule => {
        const specs = Array.isArray(rule.match) ? rule.match : [rule.match]
        const metaFields = rule.meta ?? []
        const include = rule.include ?? []

        return {
            id: rule.id,
            // conditions: resolveSpecs(specs, index),
            metaFields,
            include,
            needsMeta: metaFields.length > 0 || include.length > 0,
            groupOnly: rule.groupOnly ?? false
        }
    })
}