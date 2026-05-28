import type { PageMeta, Rule } from "../types";

export type BrowserType =
    | "chrome"
    | "edge"
    | "brave"
    | "opera"
    | "firefox"
    | "unknown";

export type SessionEndEvent = {
    event: "session_end";
    clientId: string;
    browserType: BrowserType;
    ruleIds: Array<string>;
    primaryRuleId: string;
    category: string;
    url: string;
    hostname: string;
    pathname: string;
    meta: PageMeta;
    startedAt: number;
    endAt: number;
    durationMs: number;
    tabId: number;
};

export type FocusLostEvent = { event: "focus_lost" };
export type FocusGainedEvent = { event: "focus_gained" };

export type PageMetaScannedEvent = {
    event: "page_meta_scanned";
    url: string;
    meta: PageMeta;
};

export type RuleViolationEvent = {
    event: "rule_violation";
    ruleId?: string;
    url?: string;
    message?: string;
    meta?: PageMeta;
};

export type SystemEvent = {
    event: "system_event";
    name: string;
    message?: string;
    data?: Record<string, unknown>;
};

export type FrocusEvent =
    | SessionEndEvent
    | FocusLostEvent
    | FocusGainedEvent
    | PageMetaScannedEvent
    | RuleViolationEvent
    | SystemEvent;

export type HandshakeMessage = {
    type: "handshake";
    clientId: string;
    browserType: BrowserType;
    extensionVersion: string;
};

export type EventEnvelope = { entryId: string } & FrocusEvent;

export type ClientMessage = HandshakeMessage | EventEnvelope;

export type DesktopCommand =
    | { command: "soft_block"; tabId: number }
    | { command: "hard_block"; tabId: number }
    | { command: "unblock"; tabId: number }
    | { command: "pause_media"; tabId: number }
    | { command: "resume_media"; tabId: number }
    | {
        command: "show_warning";
        tabId: number;
        message: string;
        gracePeriodMs: number;
    }
    | { command: "update_rules"; rules: Array<Rule> };

export type ServerAck = { type: "ack"; ids: Array<string> };
export type ServerMessage = ServerAck | DesktopCommand;
