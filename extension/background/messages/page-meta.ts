import type { PlasmoMessaging } from "@plasmohq/messaging";
import { tracker } from "~index";
import type { PageMetaMessage } from "~types";


const handler: PlasmoMessaging.MessageHandler<PageMetaMessage, void> = (req, res) => {
    const { meta, url } = req.body ?? {}
    const tabId = req.sender.tab.id

    if (tabId && meta && url) {
        // tracker will receive page meta
    }

    res.send()
}

export default handler