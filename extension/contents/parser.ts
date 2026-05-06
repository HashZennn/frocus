import type { PageMeta, ParsedUrl } from "../types/background";

export const normalizeHost = (host: string): string => host.replace(/^www\./i, "").toLowerCase()

export const parseRegex = (raw: string): RegExp | null => {
    try {
        const parts = raw.match(/^\/(.+)\/([gimsuy]*)$/)

        return parts ? new RegExp(parts[1], parts[2]) : new RegExp(raw)
    } catch (error) {
        return null
    }
}

export const parseUrl = (raw: string): ParsedUrl | null => {
    try {
        const { hostname, pathname } = new URL(raw)

        return {
            hostname: normalizeHost(hostname),
            pathname,
            full: raw
        }
    } catch (error) {
        return null
    }
}

export const extractPageMeta = (includeTerms: Array<string>): PageMeta => {
    const title = document.title || undefined

    const getMeta = (name: string): string | undefined => {
        return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || document.querySelector<HTMLMetaElement>(`meta[property="${name}"]`)?.content || undefined
    }

    const description = getMeta("description") ?? getMeta("og:description")
    const keywordRaw = getMeta("keywords")

    const keywords = keywordRaw ? keywordRaw.split(",").map(keyword => keyword.trim()).filter(Boolean) : undefined

    const corpus = [title, description, keywordRaw].filter(Boolean).join(" ").toLowerCase()

    const matchedTerms = includeTerms.length ? includeTerms.filter(term => corpus.includes(term.toLowerCase())) : undefined

    return {
        title,
        description,
        keywords,
        matchedTerms: matchedTerms?.length ? matchedTerms : undefined
    }
}