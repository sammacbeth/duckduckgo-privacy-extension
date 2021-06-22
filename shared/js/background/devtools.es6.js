const tldts = require('tldts')

const tabManager = require('./tab-manager.es6')
const trackers = require('./trackers.es6')
const tdsStorage = require('./storage/tds.es6')
const { removeBroken } = require('./utils.es6')
const load = require('./load.es6')

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
            const tab = tabManager.get({ tabId })
            postMessage(tabId, 'tabChange', tab)
        } else if (m.action === 'I' || m.action === 'B') {
            const { requestData, siteUrl, tracker } = m
            const matchedTracker = trackers.getTrackerData(requestData.url, siteUrl, requestData)
            if (tracker.matchedRule) {
                // find the rule for this url
                const ruleIndex = matchedTracker.tracker.rules.findIndex((r) => r.rule.toString() === tracker.matchedRule)
                const rule = matchedTracker.tracker.rules[ruleIndex]
                if (!rule.exceptions) {
                    rule.exceptions = {}
                }
                if (!rule.exceptions.domains) {
                    rule.exceptions.domains = []
                }
                if (m.action === 'B' && matchedTracker.action === 'redirect') {
                    matchedTracker.tracker.rules.splice(ruleIndex, 1)
                } else if (m.action === 'I') {
                    rule.exceptions.domains.push(new URL(siteUrl).hostname)
                } else {
                    let index = rule.exceptions.domains.indexOf(new URL(siteUrl).hostname)
                    if (index === -1) {
                        index = rule.exceptions.domains.indexOf(tldts.parse(siteUrl).domain)
                    }
                    rule.exceptions.domains.splice(index, 1)
                }
                console.log('add exception for ', matchedTracker, rule)
            } else {
                matchedTracker.tracker.default = m.action === 'I' ? 'ignore' : 'block'
            }
        } else if (m.action === 'toggleProtection') {
            const { tabId } = m
            const tab = tabManager.get({ tabId })
            if (tab.site?.isBroken) {
                removeBroken(tab.site.domain)
            } else {
                tabManager.whitelistDomain({
                    list: 'whitelisted',
                    domain: tab.site.domain,
                    value: !tab.site.whitelisted
                })
            }
            postMessage(tabId, 'tabChange', tab)
        } else if (m.action === 'toggleCanvas' || m.action === 'toggleAudio') {
            const { tabId } = m
            const feature = m.action.slice(6).toLowerCase()
            const tab = tabManager.get({ tabId })
            const enabled = !tab.site?.brokenFeatures.includes(feature)
            const excludedSites = tdsStorage.fingerprinting[feature].sites
            const domain = tldts.getDomain(tab.site.domain)
            if (enabled) {
                excludedSites.push(domain)
            } else {
                excludedSites.splice(excludedSites.indexOf(domain, 1))
            }
        } else if (m.action === 'reloadTDS') {
            let tdsUrl = 'https://staticcdn.duckduckgo.com/trackerblocking/'
            if (m.tds === 'live') {
                tdsUrl += 'v2.1/tds.json'
            } else if (m.tds === 'next') {
                tdsUrl += 'v2.1/tds-next.json'
            } else if (m.tds === 'beta') {
                tdsUrl += 'beta/tds.json'
            }
            // fetch data and update tds
            load.loadExtensionFile({ url: tdsUrl, etag: 'nope', returnType: 'json', source: 'external', timeout: 60000 }).then(res => {
                if (res && res.status === 200) {
                    trackers.setLists([{"name": "tds", "data": res.data}])
                }
            })
        }
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
