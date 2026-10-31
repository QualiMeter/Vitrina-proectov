import type { CasePublicSummary, CaseStatus } from './types';

export interface CatalogueFilters {
  search: string;
  directionId: string;
  technologyId: string;
  format: '' | 'SOLO' | 'TEAM';
  status: '' | CaseStatus;
  course: string;
  hasReward: boolean;
}

/** Filters the full local fixture collection, then applies local-only paging. */
export function selectLocalPage(items: CasePublicSummary[], filters: CatalogueFilters, page: number, pageSize: number) {
  const query = filters.search.trim().toLocaleLowerCase('ru');
  const filtered = items.filter((item) => {
    const searchable = `${item.title} ${item.companyName} ${item.rewardTerms ?? ''}`.toLocaleLowerCase('ru');
    return (!query || searchable.includes(query))
      && (!filters.directionId || item.directionIds.includes(filters.directionId))
      && (!filters.technologyId || item.technologyIds.includes(filters.technologyId))
      && (!filters.format || item.participationFormat === filters.format || item.participationFormat === 'BOTH')
      && (!filters.status || item.status === filters.status)
      && (!filters.course || ((item.minCourse ?? 1) <= Number(filters.course) && (item.maxCourse ?? 6) >= Number(filters.course)))
      && (!filters.hasReward || Boolean(item.rewardTerms));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  return { filtered, pageCount, currentPage, items: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) };
}
