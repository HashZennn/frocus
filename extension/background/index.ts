import { Storage } from "@plasmohq/storage"
import { extractPageMeta } from "../contents/parser";

export {}

class FrocusTracker {
    private storage = new Storage()
    
    test() {
        chrome.tabs.onActivated.addListener(async ({ tabId }) => {
            const tab = await chrome.tabs.get(tabId)

            console.log("FROCUS: ", tab.active, ". DETAILS: ", extractPageMeta([]))
        })
    }

}

const frocus = new FrocusTracker()
frocus.test()