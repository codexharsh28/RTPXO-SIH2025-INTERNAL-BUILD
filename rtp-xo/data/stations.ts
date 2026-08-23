import { Station } from "@/types/railway";

export const stations: Station[] = [
  {
    id: "ND",
    name: "New Delhi",

    latitude: 28.643,
    longitude: 77.219,

    platforms: 16,

    connectedSections: ["ND-GZB-01"],
  },

  {
    id: "GZB",
    name: "Ghaziabad",

    latitude: 28.669,
    longitude: 77.453,

    platforms: 6,

    connectedSections: [
      "ND-GZB-01",
      "GZB-MRT-01",
    ],
  },

  {
    id: "MRT",
    name: "Meerut",

    latitude: 28.984,
    longitude: 77.706,

    platforms: 5,

    connectedSections: [
      "GZB-MRT-01",
      "MRT-SNP-01",
    ],
  },

  {
    id: "SNP",
    name: "Saharanpur",

    latitude: 29.967,
    longitude: 77.546,

    platforms: 7,

    connectedSections: ["MRT-SNP-01"],
  },
];