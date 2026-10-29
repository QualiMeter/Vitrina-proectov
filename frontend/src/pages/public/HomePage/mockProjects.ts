export interface DemoProject { title: string; direction: string; summary: string; }
export const demoProjects: readonly DemoProject[] = [
  { title: 'Цифровой архив лаборатории', direction: 'Веб-разработка', summary: 'Пример проекта по организации исследовательских материалов и доступа к ним.' },
  { title: 'Анализ данных городской среды', direction: 'Аналитика данных', summary: 'Пример исследовательской задачи с открытыми наборами данных.' },
  { title: 'Прототип интерфейса кампуса', direction: 'Продуктовый дизайн', summary: 'Пример проектирования цифрового сервиса для университетской среды.' }
];
