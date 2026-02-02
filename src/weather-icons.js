function svgWrap(inner) {
  return `
  <svg viewBox="0 0 128 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    ${inner}
  </svg>
  `.trim();
}

function sun() {
  return svgWrap(`
    <defs>
      <radialGradient id="gSun" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="rgba(255,220,120,1)"/>
        <stop offset="100%" stop-color="rgba(251,146,60,1)"/>
      </radialGradient>
    </defs>
    <g transform="translate(64 48)">
      <circle r="16" fill="url(#gSun)" />
      <g stroke="rgba(255,220,120,.95)" stroke-width="4" stroke-linecap="round">
        <line x1="0" y1="-30" x2="0" y2="-42"/>
        <line x1="0" y1="30" x2="0" y2="42"/>
        <line x1="-30" y1="0" x2="-42" y2="0"/>
        <line x1="30" y1="0" x2="42" y2="0"/>
        <line x1="21" y1="-21" x2="30" y2="-30"/>
        <line x1="-21" y1="21" x2="-30" y2="30"/>
        <line x1="-21" y1="-21" x2="-30" y2="-30"/>
        <line x1="21" y1="21" x2="30" y2="30"/>
      </g>
    </g>
  `);
}

function cloudBase({ x = 34, y = 38, tint = "rgba(255,255,255,.92)" } = {}) {
  return `
    <g>
      <path d="M34 66c-10 0-18-7-18-16 0-8 6-15 14-16 3-10 13-18 25-18 12 0 22 7 25 18 8 1 14 8 14 16 0 9-8 16-18 16H34z"
        fill="${tint}" opacity="0.95"/>
      <path d="M34 66c-10 0-18-7-18-16 0-8 6-15 14-16 3-10 13-18 25-18 12 0 22 7 25 18 8 1 14 8 14 16 0 9-8 16-18 16H34z"
        fill="rgba(0,0,0,.12)"/>
    </g>
  `;
}

function cloudy() {
  return svgWrap(`
    ${cloudBase({ tint: "rgba(255,255,255,.92)" })}
  `);
}

function partlyCloudy() {
  return svgWrap(`
    <g transform="translate(-8,-6)">${sun()}</g>
    ${cloudBase({ tint: "rgba(255,255,255,.92)" })}
  `);
}

function rain() {
  return svgWrap(`
    ${cloudBase({ tint: "rgba(255,255,255,.92)" })}
    <g stroke="rgba(78,163,255,.95)" stroke-width="4" stroke-linecap="round">
      <line x1="46" y1="70" x2="40" y2="84"/>
      <line x1="64" y1="70" x2="58" y2="84"/>
      <line x1="82" y1="70" x2="76" y2="84"/>
    </g>
  `);
}

function thunder() {
  return svgWrap(`
    ${cloudBase({ tint: "rgba(255,255,255,.90)" })}
    <path d="M70 68l-14 0 10-18-20 0 10-20" fill="none" stroke="rgba(251,113,133,.95)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <g stroke="rgba(78,163,255,.95)" stroke-width="4" stroke-linecap="round">
      <line x1="44" y1="70" x2="38" y2="84"/>
      <line x1="88" y1="70" x2="82" y2="84"/>
    </g>
  `);
}

function fog() {
  return svgWrap(`
    ${cloudBase({ tint: "rgba(255,255,255,.86)" })}
    <g stroke="rgba(255,255,255,.70)" stroke-width="4" stroke-linecap="round">
      <line x1="28" y1="78" x2="100" y2="78"/>
      <line x1="20" y1="86" x2="92" y2="86"/>
    </g>
  `);
}

function snow() {
  return svgWrap(`
    ${cloudBase({ tint: "rgba(255,255,255,.92)" })}
    <g fill="rgba(167,139,250,.95)">
      <circle cx="46" cy="78" r="3"/>
      <circle cx="64" cy="82" r="3"/>
      <circle cx="82" cy="78" r="3"/>
    </g>
  `);
}

export function getWeatherIconSvg(weatherCode) {
  const c = Number(weatherCode);
  if (!Number.isFinite(c)) return cloudy();
  if (c === 0) return sun();
  if (c === 1 || c === 2) return partlyCloudy();
  if (c === 3) return cloudy();
  if (c === 45 || c === 48) return fog();
  if ([51, 53, 55, 56, 57].includes(c)) return rain();
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return rain();
  if ([71, 73, 75, 77, 85, 86].includes(c)) return snow();
  if ([95, 96, 99].includes(c)) return thunder();
  return cloudy();
}

