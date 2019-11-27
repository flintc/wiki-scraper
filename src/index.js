require('babel-register')({
    presets: ['es2015'],
})
const serverless = require('serverless-http')
require('./scraper')
const { wikiSearch, scrapeUrl, testStrategy, movieUrl } = require('./scraper')
const R = require('ramda')
const express = require('express')
const app = express()
const port = process.env.PORT || 5000

const getIdx = R.compose(R.findIndex(R.contains('film')), R.nth(2))
const getFilm = data => {
    const ix = getIdx(data)
    return R.compose(R.nth(ix), R.nth(3))(data)
}

app.get('/reception/:title', (req, res) => {
    scrapeUrl(R.identity, movieUrl(req.params.title)).fork(
        console.error,
        R.compose(res.send.bind(res), testStrategy)
    )
})

app.get('/search/:title', (req, res) => {
    console.log("/search/:title", req.params)
    res.set({ 'Content-Type': 'application/json' })
    console.log("a")
    wikiSearch(req.params.title)
        .map(JSON.parse)
        .map(getFilm)
        .map(scrapeUrl(testStrategy))
        //.map(JSON.stringify)
        .fork(console.error, x =>
            x.fork(console.error, R.compose(res.send.bind(res), JSON.stringify))
        )
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
