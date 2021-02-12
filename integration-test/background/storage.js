const harness = require('../helpers/harness')
const wait = require('../helpers/wait')

const testPageDomain = 'privacy-test-pages.glitch.me'

describe(`On https://${testPageDomain}/privacy-protections/storage-blocking/`, () => {
    const thirdPartyDomain = 'good.third-party.site'
    let cookies

    beforeAll(async () => {
        const { browser } = await harness.setup()
        const page = await browser.newPage()
        let iframeFullyLoaded = false
        try {
            page.on('requestfinished', (req) => {
                // once we see this url, we can consider the test completed
                iframeFullyLoaded |= req.url() === `https://${thirdPartyDomain}/privacy-protections/storage-blocking/iframe.js`
            })
            await page.goto(`https://${testPageDomain}/privacy-protections/storage-blocking/?store`, { waitUntil: 'networkidle0' })
            // eslint-disable-next-line no-unmodified-loop-condition
            while (!iframeFullyLoaded) {
                await wait.ms(100)
            }
            // collect all browser cookies
            cookies = (await page._client.send('Network.getAllCookies')).cookies
        } finally {
            await page.close()
        }
        await harness.teardown(browser)
    })

    it('does not block 1st party HTTP cookies', () => {
        const headerCookie = cookies.find(({ name, domain }) => name === 'headerdata' && domain === testPageDomain)
        expect(headerCookie).toBeTruthy()
        expect(headerCookie.expires).toBeGreaterThan(Date.now() / 1000)
    })

    it('blocks 3rd party HTTP cookies', () => {
        const headerCookie = cookies.find(({ name, domain }) => name === 'headerdata' && domain === thirdPartyDomain)
        expect(headerCookie).toBeUndefined()
    })

    it('does not block 1st party JS cookies', () => {
        const jsCookie = cookies.find(({ name, domain }) => name === 'jsdata' && domain === testPageDomain)
        expect(jsCookie).toBeTruthy()
        expect(jsCookie.expires).toBeGreaterThan(Date.now() / 1000)
    })

    it('blocks 3rd party JS cookies', () => {
        const jsCookie = cookies.find(({ name, domain }) => name === 'jsdata' && domain === thirdPartyDomain)
        expect(jsCookie).toBeUndefined()
    })

    it('restricts expiry of 1st party JS cookies set from 3rd party scripts', () => {
        const jsCookie = cookies.find(({ name, domain }) => name === 'tpdata' && domain === testPageDomain)
        expect(jsCookie).toBeTruthy()
        expect(jsCookie.expires).toBeGreaterThan(Date.now() / 1000)
        expect(jsCookie.expires).toBeLessThan((Date.now() / 1000) + 604800) // 7 days in the future
    })
})
