

class DesktopBridgeClient {

    async send(event) {
        console.log("Event: ", event)
    }
}

export const desktopBridge = new DesktopBridgeClient()