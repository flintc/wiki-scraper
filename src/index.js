require('babel-register')({
  presets: ['es2015'],
})
const { wikiSearch, wikiParse } = require('./scraper')
const R = require('ramda')
const F = require('fluture')
const L = require('partial.lenses')
const fs = require('fs')
const cors = require('cors')

const corsOptions = {
  origin: 'https://flintc.github.io',
}

const express = require('express')
const app = express()
const port = process.env.PORT || 5000

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

const where = template =>
  L.satisfying(
    L.and(L.branch(L.modify(L.leafs, R.unary(R.unless(R.isNil)), template)))
  )

const collectTitlesWhere = template => L.collect([where(template), 'title'])
const searchMovieTitles = title =>
  collectTitlesWhere({ title: R.test(new RegExp(escapeRegExp(title), ['i'])) })
const getMovieTitle = title => collectTitlesWhere({ title: R.equals(title) })

const movieInfoResolver = R.curry((strategy, title) =>
  F.node(done => fs.readFile(`./data/movies_subset3.json`, 'utf8', done))
    .pipe(F.chain(F.encase(JSON.parse)))
    .pipe(F.map(strategy(title)))
    .pipe(F.map(R.map(wikiSearch)))
    .pipe(F.chain(F.parallel(50)))
)

const resolveMovieTitles = movieInfoResolver(searchMovieTitles)
const resolveMovieTitle = movieInfoResolver(getMovieTitle)

app.get('/search/:title', cors(corsOptions), (req, res) => {
  res.set({ 'Content-Type': 'application/json' })
  resolveMovieTitle(req.params.title)
    .pipe(F.map(L.get(0)))
    .pipe(F.fork(console.error)(R.compose(res.send.bind(res), JSON.stringify)))
})

app.get('/parse/:page', cors(corsOptions), (req, res) => {
  res.set({ 'Content-Type': 'application/json' })
  movieInfoResolver(x => y => [x], req.params.page)
    .pipe(F.map(L.get(0)))
    .pipe(F.fork(console.error)(R.compose(res.send.bind(res), JSON.stringify)))
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
