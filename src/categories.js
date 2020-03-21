import fetch from 'isomorphic-fetch'
import * as L from 'partial.lenses'
import R from 'ramda'
import * as F from 'fluture'
import * as S from 'sanctuary'
const util = require('util')
const fs = require('fs')
const readFile = util.promisify(fs.readFile)
const BASE_URL = 'https://en.wikipedia.org'

const buildQuery = (year, continueQuery) =>
  BASE_URL +
  `/w/api.php?action=query&format=json&prop=description%7Ccategories%7Cpageviews&list=&generator=categorymembers&clprop=&clshow=&cllimit=500&pvipdays=5&gcmtitle=Category%3A${year}%20films&gcmprop=ids%7Ctitle&gcmtype=page&gcmlimit=500${continueQuery}`

const BASE_REST_URL = `https://en.wikipedia.org/api/rest_v1/page/summary`
const buildRestURL = title => BASE_REST_URL + `/${R.replace(' ', '_', title)}`
const where = template =>
  L.satisfying(
    L.and(L.branch(L.modify(L.leafs, R.unary(R.unless(R.isNil)), template)))
  )

const buildContinue = cont => {
  return R.reduce(
    (acc, el) => {
      return R.concat(acc, `&${el[0]}=${el[1]}`)
    },
    '',
    R.toPairs(cont)
  )
}

export const fetchMovies = async year => {
  console.log('starting!', year)
  let res
  let body
  let cont = ''
  let results = {}
  while (true) {
    const query = buildQuery(year, encodeURI(cont))
    try {
      res = await fetch(query)
    } catch (err) {
      console.log('fetch err')
    }
    try {
      body = await res.json()
    } catch (err) {
      console.log('json err')
    }
    if (body && body.error) {
      console.log(body.error)
    }
    results = R.mergeDeepRight(results, body.query.pages)
    if (!body.continue) {
      console.log('done!', year, R.values(results).length)
      break
    }
    cont = buildContinue(body.continue)
  }
  fs.writeFileSync(
    `./data/${year}.json`,
    JSON.stringify(results, null, 2),
    'utf-8'
  )
}

export const foo = year => {
  const obj = JSON.parse(fs.readFileSync(`./data/${year}.json`, 'utf8'))
  console.log(R.values(obj).length)
  const result = L.collect([
    where({
      categories: L.get(where({ title: R.test(/crime drama films/i) })),
    }),
    'title',
  ])(obj)
  console.log(
    L.collect([
      R.values,
      R.sortWith([R.ascend(x => R.sum(R.values(x.pageviews)))]),
      L.elems,
      L.pick({ title: 'title', views: ['pageviews', R.values, R.sum] }),
      //'title',
    ])(R.values(obj))
  )
  //console.log(R.sortWith([R.descend(R.prop('pageviews'))]), R.values(obj))
}

const getExtractAndPoster = async title => {
  //console.log('...AA', buildRestURL(title))
  const resp = await fetch(buildRestURL(title))
  const data = await resp.json()
  return {
    poster: L.get(['originalimage', 'source'], data),
    extract: L.get('extract', data),
  }
}

// export const resolveExtractAndPoster = titles =>
//   F.parallel(50)(R.map(R.compose(F.encaseP(fetch), buildRestURL), titles))
//     .pipe(F.map(R.map(F.encaseP(x => x.json()))))
//     .pipe(F.chain(F.parallel(50)))
//     .pipe(F.fork(console.error)(console.log))

const rateLimitedFetch = ms => async (...args) => {
  const out = await Promise.all([
    fetch(...args),
    new Promise(resolve => setTimeout(resolve, ms)),
  ])
  console.log('here')
  return out[0]
}

export const resolveExtractAndPoster = async () =>
  F.node(done => fs.readFile(`./data/movies_subset3.json`, 'utf8', done))
    .pipe(F.chain(F.encase(JSON.parse)))
    .pipe(F.map(L.collect([L.subseq(0, 3, L.elems), 'title', buildRestURL])))
    .pipe(F.map(R.map(F.encaseP(rateLimitedFetch(1500)))))
    .pipe(F.map(R.map(F.coalesce(S.Left)(S.Right))))
    .pipe(F.chain(F.parallel(200)))
    .pipe(F.map(S.rights))
    .pipe(F.map(R.map(F.encaseP(x => x.json()))))
    .pipe(F.chain(F.parallel(200)))
    .pipe(
      F.map(
        L.collect([
          L.elems,
          L.pick({ extract: 'extract', poster: ['originalimage', 'source'] }),
        ])
      )
    )
    .pipe(F.fork(console.error)(x => console.log('done', x)))

export const bar2 = () => {
  const obj = JSON.parse(fs.readFileSync(`./data/movies.json`, 'utf8'))
  console.log(R.values(obj)[0])
  const result = L.collect([
    where({
      categories: L.get(where({ title: R.test(/crime drama films/i) })),
    }),
    'title',
  ])(obj)
  const out = L.collect([
    R.values,
    R.sortWith([R.descend(L.sum(['pageviews', L.values]))]),
    R.slice(0, 20000),
    L.elems,
    L.pick({
      title: 'title',
      description: 'description',
      pageid: 'pageid',
      categories: L.collect(['categories', L.elems, 'title']),
      pageviews: ['pageviews', R.values, R.sum],
    }),
    //'title',
  ])(obj)
  //console.log('hout', out)
  fs.writeFileSync('./data/movies_subset3.json', JSON.stringify(out), 'utf8')
  //console.log(R.sortWith([R.descend(R.prop('pageviews'))]), R.values(obj))
}

export const readFilmsJson = () => {
  const db = JSON.parse(fs.readFileSync('./data/movies.json', 'utf8'))
  //console.log(R.values(db).length)
  console.log(L.collect(where({ title: R.test(/Tiptoes/i) }))(db))
}

export const mergeFilmsJson = async () => {
  const years = R.range(1950, 2020).map(async year => {
    const f = await readFile(`./data/${year}.json`, 'utf8')
    return JSON.parse(f)
  })
  Promise.all(years).then(y => {
    const db = R.mergeAll(y)
    //console.log(db)

    const out = L.collect([
      L.collect([L.values, 'categories']),
      R.flatten,
      L.elems,
      //'title',
      R.pick({ title: 'title', name: ['title', R.replace('Category:', '')] }),
      //R.uniq,
    ])(db)
    console.log(out)
    //let db = {}
    // years.map(y2 => {
    //   console.log(R.values(y2).length)
    //   db = R.merge(db, y2)
    // })
    // const db = R.reduce(
    //   (acc, el) => {
    //     console.log(R.values(el).length)
    //     return R.merge(acc, el)
    //   },
    //   {},
    //   years
    // )
    console.log(R.values(db).length)
    fs.writeFileSync(`./data/movies.json`, JSON.stringify(db, null, 2), 'utf-8')
  })
  //console.log(years[0])
  console.log('hh')
  //const foo = R.map(JSON.parse, years)

  // console.log('hhhh', typeof db)
  // console.log(R.values(db).length)
}

const readMoviesFile = file =>
  F.node(done => fs.readFile(file, 'utf8', done)).pipe(
    F.chain(F.encase(JSON.parse))
  )

export const fetchInfo = async () =>
  F.node(done => fs.readFile(`./data/movies_subset3.json`, 'utf8', done))
    .pipe(F.chain(F.encase(JSON.parse)))
    .pipe(
      F.map(
        L.collect([
          where({ title: R.test(new RegExp('Toy', ['i'])) }),
          'title',
          title => `http://localhost:5000/search/${title}`,
        ])
      )
    )
    .pipe(F.map(R.map(F.encaseP(fetch))))
    .pipe(F.chain(F.parallel(50)))
    .pipe(F.map(R.map(F.encaseP(x => x.json()))))
    .pipe(F.chain(F.parallel(50)))
    .pipe(F.fork(console.error)(console.log))

export const titleInfo = title =>
  F.node(done => fs.readFile(`./data/movies_subset3.json`, 'utf8', done))
    .pipe(F.chain(F.encase(JSON.parse)))
    .pipe(F.map(L.collect([L.whereEq({ title }), 'title'])))
// .pipe(F.map(R.tap(x => console.log('HEREEEE', x))))
// .pipe(wikiSearch)
// .pipe(F.fork(console.error)(console.log))
