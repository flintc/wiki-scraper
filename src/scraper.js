import R from 'ramda'
import * as L from 'partial.lenses'
import S from 'sanctuary'
import Future, { encaseP } from 'fluture'
import * as U from './utils/utils'
import * as C from './utils/cheerio'
import request from 'request'
import fetch from 'isomorphic-fetch'
import * as F from 'fluture'

const searchUrl = term =>
  `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=${term}`

// export const wikiSearch = term =>
//   Future((rej, res) => {
//     const opts = { method: 'GET', uri: movieUrl(term) }
//     request(opts, (error, response, body) => {
//       console.log('request result', body, error)
//       if (error) {
//         rej(error)
//       } else {
//         res(term)
//       }
//     })
//   })

const restUrl = title =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`

const movieUrl = title => `https://en.wikipedia.org/wiki/${title}`

// scrapeUrl :: (Dom -> Either Err a) -> Url -> Future Err a
const scrapeUrl = R.curry((strategy, obj) =>
  obj.pipe(F.map(C.loadDom)).pipe(F.map(strategy))
)

const getReception = S.encase(
  R.compose(
    C.text,
    R.head,
    R.filter(R.compose(R.contains('Rotten'), C.text)), // List (Maybe String)
    C.selectAll('.mw-parser-output p') // List Dom
  )
)

const getRTScore = L.get([
  R.split(' '),
  L.find(R.contains('%')),
  R.replace('%', ''),
  parseFloat,
])

const getPosterThumb = R.pipe(
  C.selectFirst('.infobox .image img'),
  R.chain(C.attr('src')),
  S.map(x => `https:${x}`)
)
const getTitle = R.compose(S.Just, C.optional('??', '.firstHeading i'))

const getDescription = S.encase(
  R.compose(
    C.text,
    R.head,
    R.filter(R.compose(R.contains('film'), C.text)), // List (Maybe String)
    C.selectAll('.mw-parser-output p') // List Dom
  )
)

const parseMoneyTableDataByHeader = L.get([
  x => x.next('td'),
  C.text,
  R.split(/\s/),
  L.modify(0, L.get([R.split('-'), 0, R.replace('$', ''), parseInt])),
  L.modify(
    1,
    R.cond([
      [R.contains('million'), () => 1000000],
      [R.contains('billion'), () => 1000000000],
    ])
  ),
  R.apply(R.multiply),
])

const getMoneyInfo = L.get([
  C.selectAll('.infobox th'),
  L.pick({
    budget: L.find(L.get([C.text, L.matches(/budget/i)])),
    boxOffice: L.find(L.get([C.text, L.matches(/box office/i)])),
  }),
  L.modify(L.values, parseMoneyTableDataByHeader),
  R.converge(R.assoc('boxToBudget'), [x => x.boxOffice / x.budget, R.identity]),
])

const testStrategy = dom => {
  const getMovieData = R.applySpec({
    title: getTitle,
    description: getDescription,
    reception: {
      text: getReception,
      score: {
        rottenTomatoes: R.compose(S.map(getRTScore), getReception),
      },
    },
    poster: getPosterThumb,
  })
  return R.merge(
    L.modify(L.leafs, R.nAry(1, S.maybeToNullable), getMovieData(dom)),
    //getMoneyInfo(dom)
    {}
  )
}

export const wikiSearch = term =>
  F.encaseP(fetch)(movieUrl(term))
    .pipe(F.chain(F.encaseP(x => x.text())))
    .pipe(scrapeUrl(testStrategy))

export { scrapeUrl, testStrategy, movieUrl }
