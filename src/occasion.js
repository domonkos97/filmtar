// What is going on today? Holidays first, then the weekend, then the season. Drives the
// daily pick, the default mood and the line under the Discover title.
// Genre ids are TMDB's: 35 comedy, 16 animation, 10751 family, 10749 romance, 10402 music,
// 12 adventure, 28 action, 18 drama, 36 history, 27 horror, 53 thriller, 80 crime, 9648 mystery, 14 fantasy.

const HALLOWEEN = /halloween|ghost|haunt|witch|vampire|monster|demon|cult|killer|slasher|kísért|szellem|boszork|gyilkos/i
const CHRISTMAS = /christmas|santa|snow|winter|family reunion|karácsony|hó\b|tél/i
const PARTY = /new year|party|celebrat|szilveszter|buli|ünnep/i
const LOVE = /love|romance|couple|marriage|wedding|szerelem|házass/i

export function occasionOf(d = new Date()) {
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = d.getDay() // 0 = Sunday

  if (month === 10 && day >= 25) {
    return {
      id: 'halloween', name: 'Halloween', mood: 'tense', genres: [27, 53, 9648], words: HALLOWEEN,
      sub: day === 31 ? 'Ma Halloween van. Ideje valami borzongatónak.' : 'Közeledik a Halloween. Hangolódj rá valami borzongatóval.',
      ask: 'Valami borzongató Halloween estére, de ne legyen túl véres.',
    }
  }
  if (month === 12 && day >= 20 && day <= 26) {
    return {
      id: 'christmas', name: 'Karácsony', mood: 'light', genres: [10751, 35, 10749, 16], words: CHRISTMAS,
      sub: day >= 24 ? 'Karácsony van. Valami meleg, közös nézésre.' : 'Közeledik a karácsony. Valami meleg, hangulatos film jöhet.',
      ask: 'Meghitt, karácsonyi hangulatú film, amit a családdal is megnézhetünk.',
    }
  }
  if ((month === 12 && day >= 27) || (month === 1 && day === 1)) {
    return {
      id: 'newyear', name: 'Szilveszter', mood: 'light', genres: [35, 10402, 12], words: PARTY,
      sub: 'Az év végén vagyunk. Valami könnyed, jó társaság mellé.',
      ask: 'Valami vidám, pörgős film szilveszterre.',
    }
  }
  if (month === 2 && day >= 12 && day <= 14) {
    return {
      id: 'valentine', name: 'Valentin-nap', mood: 'light', genres: [10749, 35, 18], words: LOVE,
      sub: 'Valentin-nap környékén vagyunk. Jöhet valami romantikus.',
      ask: 'Romantikus film Valentin-napra, ami nem túl csöpögős.',
    }
  }
  if (day === 13 && weekday === 5) {
    return {
      id: 'friday13', name: 'Péntek 13.', mood: 'tense', genres: [27, 53], words: HALLOWEEN,
      sub: 'Péntek 13. van. Ez horrorestének való.',
      ask: 'Valami ijesztő péntek 13-ra.',
    }
  }
  if (weekday === 5 || weekday === 6) {
    return {
      id: 'weekend', name: 'Hétvége', mood: 'light', genres: [35, 12, 28, 53], words: null,
      sub: weekday === 5 ? 'Péntek este van. Nem kell sietni sehová.' : 'Szombat este van. Van idő egy rendes filmre.',
      ask: 'Valami jó hétvégi esti film, amiből nem alszunk el.',
    }
  }
  if (weekday === 0) {
    return {
      id: 'sunday', name: 'Vasárnap', mood: 'deep', genres: [18, 16, 36], words: null,
      sub: 'Vasárnap este van. Valami nyugodtabb illik hozzá.',
      ask: 'Nyugodt vasárnap esti film, ami nem nyomaszt túlzottan.',
    }
  }
  if (month >= 9 && month <= 11) {
    return { id: 'autumn', name: 'Ősz', mood: 'deep', genres: [18, 9648, 80], words: null, sub: 'Őszi este van. Jöhet valami elmélyülős.', ask: 'Valami hangulatos őszi estére.' }
  }
  if (month === 12 || month <= 2) {
    return { id: 'winter', name: 'Tél', mood: 'deep', genres: [18, 14, 10749], words: CHRISTMAS, sub: 'Téli este van. Bújj be valami jó film mellé.', ask: 'Valami meleg, bekuckózós téli film.' }
  }
  if (month <= 5) {
    return { id: 'spring', name: 'Tavasz', mood: 'light', genres: [35, 10749, 12], words: null, sub: 'Tavaszi este van. Valami könnyed, derűs film jöhet.', ask: 'Valami könnyed, derűs tavaszi film.' }
  }
  return { id: 'summer', name: 'Nyár', mood: 'light', genres: [12, 35, 28], words: null, sub: 'Nyári este van. Valami lendületes, könnyed.', ask: 'Valami lendületes nyári esti film.' }
}

// How well a film fits the occasion: genre matches plus keywords in its title or synopsis
export function occasionScore(m, occ) {
  const genre = (m.genres ?? []).filter((g) => occ.genres.includes(g)).length
  const word = occ.words && occ.words.test(`${m.title} ${m.overview ?? ''}`) ? 1 : 0
  return genre * 2 + word * 3
}
