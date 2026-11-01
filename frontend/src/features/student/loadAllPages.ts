type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
/** Global filters must never silently operate on an incomplete server page. */
export async function loadAllPages<T>(
  read: (page: number) => Promise<Page<T>>,
  key: (item: T) => string,
): Promise<T[]> {
  const first = await read(1);
  if (first.page !== 1 || first.pageSize < 1 || first.total < 0)
    throw new Error("Некорректная пагинация списка.");
  const result = new Map(first.items.map((item) => [key(item), item]));
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const next = await read(page);
    if (
      next.page !== page ||
      next.total !== first.total ||
      next.pageSize !== first.pageSize
    )
      throw new Error(
        "Список изменился во время загрузки. Обновите его, чтобы применить фильтры ко всем данным.",
      );
    for (const item of next.items) result.set(key(item), item);
  }
  if (result.size !== first.total)
    throw new Error("Не удалось загрузить полный список. Повторите загрузку.");
  return [...result.values()];
}
