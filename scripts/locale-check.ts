// Checks how we decide which currency a visitor sees, and what number we
// would put in front of them.
//
// Everything that depends on a live request is out of reach here:
// resolveCurrency and requestCountry read next/headers, which only exists
// inside a render. What this covers is the logic underneath them, which is
// where the mistakes live: reading a country out of an Accept-Language
// header, mapping a country to a currency, refusing a cookie we do not
// recognise, and turning $99 into the right number of yen with the right
// number of decimal places.
//
//   npm run locale:check
import { DOLLARS_ONLY, QUOTED, quotedByCode, quotedForCountry } from "@/lib/billing/currencies";
import { estimateLocal } from "@/lib/billing/fx";
import {
  countryFromAcceptLanguage,
  formatLocal,
  localPrice,
  localPrices,
} from "@/lib/billing/locale";

function check(label: string, ok: boolean) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  // --- reading a country out of Accept-Language ---
  check(
    "ja-JP gives JP",
    countryFromAcceptLanguage("ja-JP,ja;q=0.9,en;q=0.8") === "JP",
  );
  check(
    "a weighted list takes the first tag that names a country",
    countryFromAcceptLanguage("en;q=0.9,pt-BR;q=0.8") === "BR",
  );
  check("da-DK gives DK", countryFromAcceptLanguage("da-DK") === "DK");
  // A language is not a country. "ko" does not mean Korea; plenty of people
  // read Korean outside it, and guessing here would put a won price in front
  // of someone paying in dollars.
  check("a bare language gives nothing", countryFromAcceptLanguage("ko") === null);
  check("nonsense gives nothing", countryFromAcceptLanguage("!!!") === null);
  check("an absent header gives nothing", countryFromAcceptLanguage(null) === null);
  check("lower case is normalised", countryFromAcceptLanguage("pt-br") === "BR");

  // --- country to currency ---
  for (const currency of QUOTED) {
    check(
      `${currency.country} picks ${currency.code}`,
      quotedForCountry(currency.country)?.code === currency.code,
    );
  }
  check("the US gets no conversion", quotedForCountry("US") === null);
  check("France gets no conversion, we do not quote euros", quotedForCountry("FR") === null);
  check("an unknown country gets no conversion", quotedForCountry("ZZ") === null);
  check("a null country gets no conversion", quotedForCountry(null) === null);

  // --- cookie values ---
  check("a known cookie resolves", quotedByCode("jpy")?.country === "JP");
  check("case does not matter", quotedByCode("JPY")?.country === "JP");
  // The dollars-only cookie must not resolve to a quoted currency, or
  // choosing dollars would silently convert anyway.
  check("the dollars-only value is not a quoted currency", quotedByCode(DOLLARS_ONLY) === null);
  check("a currency we dropped is ignored", quotedByCode("eur") === null);
  check("junk is ignored", quotedByCode("';drop") === null);

  // --- formatting, which is where minor units bite ---
  // Yen and won have no minor unit, so "16168" means sixteen thousand yen
  // and must never render as 161.68. Real and krone do have one. The symbol
  // and its position vary by locale, so this looks at the digits: the last
  // run after a separator is a fraction when it is two long and a thousands
  // group when it is three. Formatted forms are ￥16,168 and 670,40 kr.
  const hasFraction = (formatted: string) => {
    // Trailing separators have to go first: Danish renders "670,40 kr." and
    // the full stop in "kr." would otherwise read as an empty last group.
    const digits = formatted.replace(/[^\d.,]/g, "").replace(/[.,]+$/, "");
    const groups = digits.split(/[.,]/);
    return groups.length > 1 && groups[groups.length - 1].length === 2;
  };
  const jpy = quotedByCode("jpy")!;
  const krw = quotedByCode("krw")!;
  const brl = quotedByCode("brl")!;
  const dkk = quotedByCode("dkk")!;
  check(`yen shows no minor unit (${formatLocal(16168, jpy)})`, !hasFraction(formatLocal(16168, jpy)));
  check(`won shows no minor unit (${formatLocal(142696, krw)})`, !hasFraction(formatLocal(142696, krw)));
  check(`real shows two (${formatLocal(529.44, brl)})`, hasFraction(formatLocal(529.44, brl)));
  check(`kroner shows two (${formatLocal(670.4, dkk)})`, hasFraction(formatLocal(670.4, dkk)));

  // --- the estimate itself ---
  // 1 JPY = 0.00636813 USD was the rate when the 4% was measured against a
  // live checkout page showing 16,168 yen. If this ever stops holding, the
  // arithmetic changed, not the market.
  const yen = estimateLocal(9900, 0.00636813);
  check(`$99 at that rate is 16168 yen (got ${yen.toFixed(2)})`, Math.round(yen) === 16168);

  // --- against the real mirror ---
  const pro = await localPrice(9900, jpy);
  check("the mirror answers for a currency we quote", pro !== null);
  if (pro) console.log(`      $99 Pro reads ${pro.formatted}, rate from ${pro.asOf.toISOString()}`);

  check("no currency means no estimate", (await localPrice(9900, null)) === null);
  check("no amounts means no estimate", (await localPrices([], jpy)) === null);

  const many = await localPrices([2900, 9900, 15000], jpy);
  check("several prices come back together", many?.size === 3);
  if (many) {
    console.log(
      `      Plus ${many.get(2900)?.formatted}, ` +
        `Pro ${many.get(9900)?.formatted}, ` +
        `Pass ${many.get(15000)?.formatted}`,
    );
    // Same rate for all three, so the ratios must survive conversion.
    const plus = Number(many.get(2900)!.formatted.replace(/[^\d.]/g, ""));
    const proAmount = Number(many.get(9900)!.formatted.replace(/[^\d.]/g, ""));
    check(
      "the converted prices keep their proportions",
      Math.abs(proAmount / plus - 9900 / 2900) < 0.01,
    );
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
