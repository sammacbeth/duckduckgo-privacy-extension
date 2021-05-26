const table = document.querySelector('#request-table')
const clearButton = document.getElementById('clear')
const refreshButton = document.getElementById('refresh')
const protectionButton = document.getElementById('protection')
const canvasButton = document.getElementById('canvas')
const audioButton = document.getElementById('audio')
const tabId = chrome.devtools.inspectedWindow.tabId
const port = chrome.runtime.connect()

const cookieRowTemplate = document.getElementById('cookie-row')

port.onMessage.addListener((message) => {
    const m = JSON.parse(message)
    if (m.tabId === tabId) {
        if (m.action === 'tracker') {
            const { tracker, url, requestData, siteUrl } = m.message
            const row = document.createElement('tr')
            const exceptionCell = document.createElement('td')
            const toggleLink = document.createElement('a')
            toggleLink.href = ''
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
                    siteUrl
                })
                row.classList.remove(tracker.action)
                row.classList.add(toggleLink.innerText === 'I' ? 'ignore' : 'block')
            })
            exceptionCell.appendChild(toggleLink)
            row.appendChild(exceptionCell);
            [tracker.action, tracker.reason, tracker.fullTrackerDomain, tracker.matchedRule || '', tracker.matchedRuleException, url].forEach((text) => {
                const cell = document.createElement('td')
                cell.innerText = text
                row.appendChild(cell)
            })
            row.classList.add(tracker.action)
            table.appendChild(row)
        } else if (m.action === 'tabChange') {
            const tab = m.message
            protectionButton.innerText = `Protection: ${tab.site?.whitelisted || tab.site?.isBroken ? 'OFF' : 'ON'}`
            canvasButton.innerText = `Canvas: ${tab.site?.brokenFeatures.includes('canvas') ? 'OFF' : 'ON'}`
            audioButton.innerText = `Audio: ${tab.site?.brokenFeatures.includes('audio') ? 'OFF' : 'ON'}`
        } else if (m.action === 'cookie') {
            const { action, kind, url } = m.message
            const row = cookieRowTemplate.content.cloneNode(true)
            const cells = row.querySelectorAll('td')
            cells[1].textContent = action
            cells[2].textContent = kind
            cells[3].textContent = url
            row.classList.add(kind)
            table.appendChild(row)
        }
    }
})
port.postMessage({ action: 'setTab', tabId })

function clear () {
    while (table.lastChild) {
        table.removeChild(table.lastChild)
    }
}

// buttons and toggles
clearButton.addEventListener('click', clear)
refreshButton.addEventListener('click', () => {
    clear()
    chrome.devtools.inspectedWindow.eval('window.location.reload();')
})
protectionButton.addEventListener('click', () => {
    port.postMessage({
        action: 'toggleProtection',
        tabId
    })
})
canvasButton.addEventListener('click', () => {
    port.postMessage({
        action: 'toggleCanvas',
        tabId
    })
})
audioButton.addEventListener('click', () => {
    port.postMessage({
        action: 'toggleAudio',
        tabId
    })
})
