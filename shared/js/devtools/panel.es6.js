const table = document.querySelector('#request-table')
const clearButton = document.getElementById('clear')
const refreshButton = document.getElementById('refresh')
const protectionButton = document.getElementById('protection')
const tabPicker = document.getElementById('tab-picker')

let tabId = chrome.devtools?.inspectedWindow?.tabId
const port = chrome.runtime.connect()
const features = [
    'canvas',
    'audio',
    'referrer',
    'floc',
    'autofill'
]

port.onMessage.addListener((message) => {
    const m = JSON.parse(message)
    if (m.tabId === tabId) {
        if (m.action === 'tracker') {
            const { tracker, url, requestData, siteUrl } = m.message
            const row = document.getElementById('request-row').content.firstElementChild.cloneNode(true)
            const cells = row.querySelectorAll('td')
            const toggleLink = row.querySelector('.block-toggle')
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
            });
            [tracker.action, tracker.reason, tracker.fullTrackerDomain, tracker.matchedRule || '', tracker.matchedRuleException, url].forEach((text, i) => {
                cells[i + 1].innerText = text
            })
            row.classList.add(tracker.action)
            table.appendChild(row)
        } else if (m.action === 'tabChange') {
            const tab = m.message
            protectionButton.innerText = `Protection: ${tab.site?.whitelisted || tab.site?.isBroken ? 'OFF' : 'ON'}`
            features.forEach((feature) => {
                document.getElementById(feature).innerText =`${feature}: ${tab.site?.brokenFeatures.includes(feature) ? 'OFF' : 'ON'}`
            })
        } else if (m.action === 'cookie') {
            const { action, kind, url } = m.message
            const row = document.getElementById('cookie-row').content.firstElementChild.cloneNode(true)
            const cells = row.querySelectorAll('td')
            const cleanUrl = new URL(url)
            cleanUrl.search = ''
            cleanUrl.hash = ''
            cells[1].textContent = action
            cells[2].textContent = kind
            cells[3].textContent = cleanUrl.href
            row.classList.add(kind)
            table.appendChild(row)
        }
    }
})

if (!chrome.devtools) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url.startsWith('http')) {
                const elem = document.createElement('option')
                elem.value = tab.id
                elem.innerText = tab.title
                tabPicker.appendChild(elem)
            }
        })
    })
    tabPicker.addEventListener('change', () => {
        tabId = parseInt(tabPicker.selectedOptions[0].value)
        clear()
        port.postMessage({ action: 'setTab', tabId })
    })
} else {
    tabPicker.hidden = true
    port.postMessage({ action: 'setTab', tabId })
}

function clear () {
    while (table.lastChild) {
        table.removeChild(table.lastChild)
    }
}

// buttons and toggles
clearButton.addEventListener('click', clear)
refreshButton.addEventListener('click', () => {
    clear()
    if (chrome.devtools) {
        chrome.devtools.inspectedWindow.eval('window.location.reload();')
    } else {
        chrome.tabs.reload(tabId)
    }
})
protectionButton.addEventListener('click', () => {
    port.postMessage({
        action: 'toggleProtection',
        tabId
    })
})

features.forEach((feature) => {
    const btn = document.createElement('button')
    btn.id = feature
    btn.innerText = `${feature}: ???`
    document.querySelector('.header').appendChild(btn)
    btn.addEventListener('click', () => {
        port.postMessage({
            action: `toggle${feature}`,
            tabId
        })
    })
})