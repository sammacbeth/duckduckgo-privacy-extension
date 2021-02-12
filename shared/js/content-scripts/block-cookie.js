// Set up 3rd party cookie blocker
(function cookieBlocker () {
    // don't inject into non-HTML documents (such as XML documents)
    // but do inject into XHTML documents
    if (document instanceof HTMLDocument === false && (
        document instanceof XMLDocument === false ||
        document.createElement('div') instanceof HTMLDivElement === false
    )) {
        return
    }

    function clearInjectedCookiesAndBlock () {
        // Clear previously set cookies
        var cookies = document.cookie.split('; ')
        for (var c = 0; c < cookies.length; c++) {
            var d = window.location.hostname
            var cookieBase = encodeURIComponent(cookies[c].split(';')[0].split('=')[0]) + '=; expires=Thu, 01-Jan-1970 00:00:01 GMT; domain=' + d + ' ;path='
            var p = location.pathname.split('/')
            document.cookie = cookieBase + '/'
            while (p.length > 0) {
                document.cookie = cookieBase + p.join('/')
                p.pop()
            };
        }

        // disable setting cookies
        document.__defineSetter__('cookie', function (value) { })
        document.__defineGetter__('cookie', () => '')
    }

    /**
     * Apply an expiry policy to cookies set via document.cookie.
     * @param {string} secret Used to detect messages sent from the extension content-script
     */
    function applyCookieExpiryPolicy (secret) {
        const debug = false
        const cookieSetter = document.__lookupSetter__('cookie')
        const cookieGetter = document.__lookupGetter__('cookie')
        const lineTest = /(\()?(http[^)]+):[0-9]+:[0-9]+(\))?/

        // Listen for a message from the content script which will configure the policy for this context
        const loadPolicy = new Promise((resolve) => {
            const messageListener = (event) => {
                if (event && event.isTrusted && event.data && event.data.source === secret) {
                    resolve(event.data)
                    window.removeEventListener('message', messageListener)
                }
            }
            window.addEventListener('message', messageListener)
        })
        document.__defineSetter__('cookie', (value) => {
            // call the native document.cookie implementation. This will set the cookie immediately
            // if the value is valid. We will override this set later if the policy dictates that
            // the expiry should be changed.
            cookieSetter.apply(document, [value])
            try {
                // determine the origins of the scripts in the stack
                const stack = new Error().stack.split('\n')
                const scriptOrigins = stack.reduce((origins, line) => {
                    const res = line.match(lineTest)
                    if (res && res[2]) {
                        origins.push(new URL(res[2]).hostname)
                    }
                    return origins
                }, [])

                // wait for config before doing same-site tests
                loadPolicy.then(({ tabRegisteredDomain, policy }) => {
                    if (!tabRegisteredDomain) {
                        // no site domain for this site to test against, abort
                        debug && console.log('[ddg-cookie-policy] policy disabled on this page')
                        return
                    }
                    const sameSiteScript = scriptOrigins.every((host) => host === tabRegisteredDomain || host.endsWith(`.${tabRegisteredDomain}`))
                    if (sameSiteScript) {
                        // cookies set by scripts loaded on the same site as the site are not modified
                        debug && console.log('[ddg-cookie-policy] ignored (sameSite)', value, scriptOrigins)
                        return
                    }
                    // extract cookie expiry from cookie string
                    const cookieParts = value.split(';')
                    const maxAgeIdx = cookieParts.findIndex(part => part.trim().toLowerCase().startsWith('max-age'))
                    const expiresIdx = cookieParts.findIndex(part => part.trim().toLowerCase().startsWith('expires'))
                    if (maxAgeIdx === -1 && expiresIdx === -1) {
                        // session cookie
                        return
                    }
                    const expiry = maxAgeIdx >= 0
                        ? parseInt(cookieParts[maxAgeIdx].split('=')[1])
                        : (new Date(cookieParts[expiresIdx].split('=')[1]) - new Date()) / 1000
                    // apply cookie policy
                    if (expiry > policy.threshold) {
                        if (maxAgeIdx === -1) {
                            cookieParts.push(`max-age=${policy.maxAge}`)
                        } else {
                            cookieParts.splice(maxAgeIdx, 1, `max-age=${policy.maxAge}`)
                        }
                        debug && console.log('[ddg-cookie-policy] update', cookieParts.join(';'), scriptOrigins)
                        cookieSetter.apply(document, [cookieParts.join(';')])
                    } else {
                        debug && console.log('[ddg-cookie-policy] ignored (expiry)', value, scriptOrigins)
                    }
                })
            } catch (e) {
                // suppress error in cookie override to avoid breakage
                debug && console.warn('Error in cookie override', e)
            }
        })
        document.__defineGetter__('cookie', cookieGetter)
    }

    /**
     * Inject a script to run in the document context.
     * @param {Function} func Function to run
     * @param {string} arg Optional argument to pass to the function
     */
    function inject (func, arg) {
        const scriptString = `(${func.toString()})('${arg}')`
        const doc = window.wrappedJSObject ? window.wrappedJSObject.document : document
        const scriptElement = doc.createElement('script')
        scriptElement.innerHTML = scriptString
        doc.documentElement.prepend(scriptElement)
    }

    /**
     * A shared secret between the content script and scripts injected into the document context.
     */
    const MSG_SECRET = `ddg-${Math.floor(Math.random() * 1000000)}`
    // The cookie expiry policy is injected into every frame immediately so that no cookie will
    // be missed.
    inject(applyCookieExpiryPolicy, MSG_SECRET)

    chrome.runtime.sendMessage({
        'checkThirdParty': true
    }, function (action) {
        if (window.top !== window && action.shouldBlock) {
            // overrides expiry policy with blocking - only in subframes
            inject(clearInjectedCookiesAndBlock)
        }
        // inform the injected script of the policy for this frame
        window.postMessage({
            source: MSG_SECRET,
            ...action
        }, document.location.origin)
    })
})()
