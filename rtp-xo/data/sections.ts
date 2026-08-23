import { RailwaySection } from "@/types/railway";

export const sections: RailwaySection[] = [
  {
    id: "ND-GZB-01",
    name: "New Delhi – Ghaziabad",
    startStation: "ND",
    endStation: "GZB",
    lengthKm: 25,
    maximumSpeed: 130,
    status: "AVAILABLE",
    occupiedBy: null,
  },

  {
    id: "GZB-MRT-01",
    name: "Ghaziabad – Meerut",
    startStation: "GZB",
    endStation: "MRT",
    lengthKm: 46,
    maximumSpeed: 120,
    status: "AVAILABLE",
    occupiedBy: null,
  },

  {
    id: "MRT-SNP-01",
    name: "Meerut – Saharanpur",
    startStation: "MRT",
    endStation: "SNP",
    lengthKm: 115,
    maximumSpeed: 110,
    status: "AVAILABLE",
    occupiedBy: null,
  },
];