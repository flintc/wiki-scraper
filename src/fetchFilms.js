require('babel-register')({
  presets: ['es2015'],
})
const fs = require('fs')
const R = require('ramda')
const F = require('fluture')
const L = require('partial.lenses')
const {
  fetchMovies,
  foo,
  bar,
  readFilmsJson,
  mergeFilmsJson,
  titleInfo,
  resolveExtractAndPoster,
} = require('./categories')

const { wikiSearch } = require('./scraper')
// R.range(1950, 2020).map(year => {
//   //if (!fs.existsSync(`./data/${year}.json`)) {
//   //console.log(year)
//   fetchMovies(year)
//   //}
// })

//foo(2004)
//fetchMovies(2004)
//readFilmsJson()
//mergeFilmsJson()
//bar()
//fetchInfo()
// titleInfo('The Terminal')
//   .pipe(F.map(R.map(wikiSearch)))
//   .pipe(F.chain(F.parallel(50)))
//   .pipe(F.map(L.get(0)))
//   .pipe(
//     F.fork(console.error)(x => {
//       console.log(typeof x, JSON.stringify(x))
//     })
//   )

resolveExtractAndPoster(['The Terminal'])
