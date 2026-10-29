import type { Profile } from "./types";

// Fictional people, written to exercise very different cultural worlds.
export const samples: Record<string, Profile & { blurb: string }> = {
  rosa: {
    blurb: "Born 1946 · Tejano San Antonio · church choir & cafeteria cook",
    name: "Rosa",
    birthYear: 1946,
    grewUp: "San Antonio, Texas",
    heritage: "Mexican-American (Tejana), Catholic",
    languages: "Spanish and English",
    loves:
      "Pedro Infante movies with her sisters, dancing to boleros and conjunto at weddings, Lydia Mendoza, her mother's tamales at Christmas, singing in the church choir. Worked 30 years as a school cafeteria cook.",
    avoid: "Hospitals and anything medical. Loud crowds.",
    diet: "Soft foods, type 2 diabetes",
    careCity: "Houston, Texas",
    relation: "granddaughter",
  },
  walter: {
    blurb: "Born 1941 · Detroit · Motown, the Tigers & Sunday church",
    name: "Walter",
    birthYear: 1941,
    grewUp: "Detroit, Michigan",
    heritage: "African-American, Baptist",
    languages: "English",
    loves:
      "Motown: Marvin Gaye and the Temptations. Detroit Tigers baseball on the radio. Worked the line at the Ford Rouge plant. Westerns on TV like Gunsmoke. Smothered pork chops after church.",
    avoid: "War films and anything about Vietnam (he served there).",
    diet: "Easy to chew, low sodium",
    careCity: "Atlanta, Georgia",
    relation: "son",
  },
  mei: {
    blurb: "Born 1952 · Hong Kong → San Francisco · Teresa Teng & dim sum",
    name: "Mei",
    birthYear: 1952,
    grewUp: "Hong Kong",
    adultHome: "San Francisco from 1975",
    heritage: "Cantonese Chinese, Buddhist",
    languages: "Cantonese, some English",
    loves:
      "Teresa Teng songs, Cantonese opera with her father, Shaw Brothers films, dim sum every Sunday, mahjong with friends. Laughed at The Carol Burnett Show after moving to America.",
    avoid: "Loud, violent action movies.",
    diet: "Soft foods; vegetarian on Buddhist holy days",
    careCity: "San Francisco, California",
    relation: "daughter",
  },
};
