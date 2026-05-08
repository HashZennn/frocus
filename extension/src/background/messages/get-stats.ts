import type { PlasmoMessaging } from "@plasmohq/messaging";
import { tracker } from "~background/index";
import { readAllTime } from "~lib/store";


const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
    const rules = tracker.getRules()
    const ruleIds = rules.map(rule => rule.id)

    const stored = await readAllTime(ruleIds)
    const pending = tracker.getTimeAccumulator()

    const totals: Record<string, number> = {}

    for (const id of ruleIds) {
        totals[id] = (stored[id] ?? 0) + (pending[id] ?? 0)
    }

    res.send({
        totals,
        activeSession: tracker.getSession()
    })
}

export default handler