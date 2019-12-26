require('babel-register')({
  presets: ['es2015'],
})
const { wikiSearch } = require('./scraper')
const R = require('ramda')
const F = require('fluture')
const L = require('partial.lenses')
const fs = require('fs')

const express = require('express')
const app = express()
const port = process.env.PORT || 5000

const where = template =>
  L.satisfying(
    L.and(L.branch(L.modify(L.leafs, R.unary(R.unless(R.isNil)), template)))
  )

const collectTitlesWhere = template => L.collect([where(template), 'title'])
const searchMovieTitles = title =>
  collectTitlesWhere({ title: R.test(new RegExp(title, ['i'])) })
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

app.get('/search/:title', (req, res) => {
  res.set({ 'Content-Type': 'application/json' })
  resolveMovieTitle(req.params.title)
    .pipe(F.map(L.get(0)))
    .pipe(F.fork(console.error)(R.compose(res.send.bind(res), JSON.stringify)))
})

// app.get('/search/:title', (req, res) => {
//   res.set({ 'Content-Type': 'application/json' })
//   resolveMovieTitles(req.params.title).pipe(
//     F.fork(console.error)(R.compose(res.send.bind(res), JSON.stringify))
//   )
// })

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
