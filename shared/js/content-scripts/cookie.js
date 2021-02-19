class Cookie {
    constructor(cookieString) {
        this.raw = cookieString
        this.parts = this.raw.split(';')
    }

    getExpiry() {
        const maxAgeIdx = this.parts.findIndex(part => part.trim().toLowerCase().startsWith('max-age'))
        const expiresIdx = this.parts.findIndex(part => part.trim().toLowerCase().startsWith('expires'))
        if (maxAgeIdx === -1 && expiresIdx === -1) {
            return NaN
        }
        const expiry = maxAgeIdx >= 0
            ? parseInt(this.parts[maxAgeIdx].split('=')[1])
            : (new Date(this.parts[expiresIdx].split('=')[1]) - new Date()) / 1000
        return expiry;
    }
}

// support node-requires (for test import)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cookie
}
