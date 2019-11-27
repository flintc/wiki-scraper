require('babel-register')({
    presets: ['es2015'],
})
require('./scraper')
const R = require('ramda')
const { wikiSearch, scrapeUrl, testStrategy } = require('./scraper')

title = 'Toy Story'

const getIdx = R.compose(R.findIndex(R.contains('film')), R.nth(2))

const getFilm = data => {
    const ix = getIdx(data)
    return R.compose(R.nth(ix), R.nth(3))(data)
}

wikiSearch(title)
    .map(JSON.parse)
    .map(getFilm)
    .map(scrapeUrl(testStrategy))
    .fork(console.error, x => x.fork(console.error, console.log))
