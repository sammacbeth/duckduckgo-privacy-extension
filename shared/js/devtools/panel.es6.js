const { post } = require("request");

const table = document.querySelector('#request-table')
const tabId = chrome.devtools.inspectedWindow.tabId
const port = chrome.runtime.connect()
port.onMessage.addListener((message) => {
    const m = JSON.parse(message)
    if (m.tabId === tabId) {
        if (m.action === 'tracker') {
            const { tracker, url, requestData, siteUrl } = m.message;
            const row = document.createElement('tr');
            const exceptionCell = document.createElement('td')
            const toggleLink = document.createElement('a')
            toggleLink.href = '';
            if (tracker.action === 'block') {
                toggleLink.innerText = 'I'
            } else {
                toggleLink.innerText = 'B'
            }
            toggleLink.addEventListener('click', (ev) => {
                ev.preventDefault()
                port.postMessage({
                    action: toggleLink.innerText,
                    tabId,
                    tracker,
                    requestData,
                    siteUrl,
                })
                row.classList.remove(tracker.action)
                row.classList.add(toggleLink.innerText === 'I' ? 'ignore' : 'block')
            })
            exceptionCell.appendChild(toggleLink);
            row.appendChild(exceptionCell);
            [tracker.action, tracker.reason, tracker.fullTrackerDomain, tracker.matchedRule, tracker.matchedRuleException, url].forEach((text) => {
                const cell = document.createElement('td')
                cell.innerText = text
                row.appendChild(cell)
            });
            row.classList.add(tracker.action)
            table.appendChild(row)
        } else if (m.action === 'tabChange') {
            const tab = m.message;
            console.log('tab', tab)
            document.querySelector('#protection-disabled').innerText = `Protection disabled: ${tab.site?.whitelisted ? 'YES' : 'NO'}`
            document.querySelector('#broken-features').innerText = `Broken features: ${tab.site?.brokenFeatures.join(',')}`
        }
    }
})
port.postMessage({ action: 'setTab', tabId })

function clear() {
    while (table.lastChild) {
        table.removeChild(table.lastChild);
    }
}

document.getElementById('clear').addEventListener('click', clear)

document.getElementById('refresh').addEventListener('click', () => {
    clear()
    chrome.devtools.inspectedWindow.eval("window.location.reload();")
})