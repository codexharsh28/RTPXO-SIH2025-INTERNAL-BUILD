import { Junction } from "@/types/railway";

export const junctions: Junction[] = [
  {
    id: "J-GZB-01",

    name: "Ghaziabad Junction",

    stationId: "GZB",

    connectedSections: [
      "ND-GZB-01",
      "GZB-MRT-01",
    ],

    activeRoute: "GZB-MRT-01",

    conflictRoutes: [
      "ND-GZB-01",
      "GZB-MRT-01",
    ],
  },

  {
    id: "J-MRT-01",

    name: "Meerut Junction",

    stationId: "MRT",

    connectedSections: [
      "GZB-MRT-01",
      "MRT-SNP-01",
    ],

    activeRoute: null,

    conflictRoutes: [],
  },
];