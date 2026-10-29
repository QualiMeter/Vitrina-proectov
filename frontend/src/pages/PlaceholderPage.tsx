import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/university': 'Кабинет сотрудника университета', '/university/moderation': 'Модерация', '/university/companies': 'Компании', '/university/companies/new': 'Новая компания', '/university/curators': 'Кураторы', '/university/projects': 'Проекты', '/university/reports': 'Отчёты',
  '/mentor': 'Кабинет куратора', '/admin': 'Кабинет администратора', '/admin/users': 'Пользователи', '/admin/directories': 'Справочники', '/admin/companies': 'Компании', '/admin/audit': 'Журнал аудита'
};

export function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? (pathname.endsWith('/progress') ? 'Ход проекта' : pathname.includes('/users/') ? 'Пользователь' : pathname.includes('/companies/') ? 'Компания' : 'Карточка проекта');
  return <div className="placeholder"><span className="placeholder__label">Структура раздела</span><h1>{title}</h1><p>Маршрут подготовлен для дальнейшей разработки команды.</p><div className="placeholder__notice"><strong>Раздел ещё не реализован</strong><p>Данные, действия, авторизация и проверка прав появятся после согласования API и сценариев. Эта страница не является рабочим кабинетом.</p></div></div>;
}
