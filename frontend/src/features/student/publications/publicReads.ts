import { ApiError } from "../../../api/client";
import type {
  PublicationGateway,
  PublicProject,
  PublicWork,
  ProjectQuery,
} from "./models";
/** Fail closed on a private DTO. The server must still enforce publication and access rules. */
function checkProjection(item: PublicProject | PublicWork) {
  if (
    "moderationNotes" in item ||
    "version" in item ||
    "authorId" in item ||
    "moderation" in item
  )
    throw new ApiError("notFound", 404);
}
export async function readPublicPortfolio(api: PublicationGateway, id: string) {
  const result = await api.publicPortfolio(id);
  result.works.forEach(checkProjection);
  result.projects.forEach(checkProjection);
  return result;
}
export async function readPublicProject(api: PublicationGateway, id: string) {
  const result = await api.publicProject(id);
  checkProjection(result);
  return result;
}
export async function readPublicCatalog(
  api: PublicationGateway,
  query: ProjectQuery,
  page: number,
) {
  const result = await api.catalog(query, page);
  result.items.forEach(checkProjection);
  return result;
}
