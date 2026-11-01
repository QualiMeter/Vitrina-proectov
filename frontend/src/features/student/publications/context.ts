import { createContext, useContext } from "react";
import type { PublicationGateway } from "./models";
export const PublicationContext = createContext<PublicationGateway | null>(
  null,
);
export class PublicationUnavailable extends Error {
  constructor() {
    super("Раздел пока недоступен. Можно открыть демонстрационный пример.");
  }
}
const unavailable = async (): Promise<never> => {
  throw new PublicationUnavailable();
};
/** No endpoints invented before BE-32/BE-22/BE-23 approval. No live-to-demo fallback. */
export const blockedPublicationGateway: PublicationGateway = {
  reference: unavailable,
  portfolio: unavailable,
  publicPortfolio: unavailable,
  getOwned: unavailable,
  save: unavailable,
  submitForModeration: unavailable,
  hideWork: unavailable,
  catalog: unavailable,
  publicProject: unavailable,
  upload: unavailable,
  mediaBlob: unavailable,
};
export function usePublications(demo: boolean) {
  const api = useContext(PublicationContext);
  if (!demo) return blockedPublicationGateway;
  if (!api) throw new Error("Демонстрационный источник не подключён.");
  return api;
}
