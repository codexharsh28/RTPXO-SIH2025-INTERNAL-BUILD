import { Signal } from "@/types/railway";

export const signals: Signal[] = [
  {
    id: "SIG-ND-01",
    name: "New Delhi Departure Signal",
    stationId: "ND",
    sectionId: "ND-GZB-01",
    aspect: "GREEN",
  },
  {
    id: "SIG-GZB-01",
    name: "Ghaziabad Entry Signal",
    stationId: "GZB",
    sectionId: "ND-GZB-01",
    aspect: "GREEN",
  },
  {
    id: "SIG-GZB-02",
    name: "Ghaziabad Meerut Signal",
    stationId: "GZB",
    sectionId: "GZB-MRT-01",
    aspect: "GREEN",
  },
  {
    id: "SIG-MRT-01",
    name: "Meerut Departure Signal",
    stationId: "MRT",
    sectionId: "MRT-SNP-01",
    aspect: "GREEN",
  },
];