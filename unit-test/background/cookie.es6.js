const Cookie = require('../../shared/js/content-scripts/cookie')

describe('Cookie', () => {
    it('exists', () => {
        expect(Cookie).toBeTruthy()
    })

    it('getExpiry', () => {
        const cki = new Cookie('key=value;max-age=1600')
        expect(cki.getExpiry()).toEqual(100)
    })
})
