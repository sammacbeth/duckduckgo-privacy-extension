const tldts = require('tldts')

const tabManager = require('./tab-manager.es6')
const trackers = require('./trackers.es6')

const ports = new Map()

function init () {
    chrome.runtime.onConnect.addListener(connected)
}

function connected (port) {
    let tabId = -1
    port.onMessage.addListener((m) => {
        if (m.action === 'setTab') {
            tabId = m.tabId
            ports.set(tabId, port)
            const tab = tabManager.get({ tabId: m.getTab })
            console.log('xxx', tab)
            // postMessage(tabId, `Tab ID: ${m.getTab}`)
            // postMessage(tabId, `isBroken: ${tab.site.isBroken}`)
            // postMessage(tabId, `Broken features: ${tab.site.brokenFeatures}`)
            // postMessage(tabId, `Site is whitelisted?: ${tab.site.whitelisted}`)
            postMessage(tabId, 'tabChange', tab)
        } else if (m.action === 'I' || m.action === 'B') {
            const { requestData, siteUrl, tracker } = m;
            const matchedTracker = trackers.getTrackerData(requestData.url, siteUrl, requestData)
            if (tracker.matchedRule) {
                // find the rule for this url
                const rule = matchedTracker.tracker.rules.find((r) => r.rule.toString() === tracker.matchedRule)
                if (!rule.exceptions) {
                    rule.exceptions = {}
                }
                if (!rule.exceptions.domains) {
                    rule.exceptions.domains = []
                }
                if (m.action === 'I') {
                    rule.exceptions.domains.push(new URL(siteUrl).hostname)
                } else {
                    let index = rule.exceptions.domains.indexOf(new URL(siteUrl).hostname)
                    if (index === -1) {
                        index = rule.exceptions.domains.indexOf(tldts.parse(siteUrl).domain)
                    }
                    rule.exceptions.domains.splice(index, 1)
                }
                console.log('add exception for ', matchedTracker);
            } else {
                matchedTracker.tracker.default = m.action === 'I' ? 'ignore' : 'block'
            }
        }
        console.log('xxx', m)
    })
    port.onDisconnect.addListener(() => {
        if (tabId !== -1) {
            ports.delete(tabId)
        }
    })
}

function postMessage (tabId, action, message) {
    if (ports.has(tabId)) {
        ports.get(tabId).postMessage(JSON.stringify({ tabId, action, message }))
    }
}

module.exports = {
    init,
    postMessage
}
