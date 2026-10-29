import { PublicHeader } from '../../../components/layout/PublicHeader';
import { ButtonLink } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { demoProjects } from './mockProjects';
import './home.css';

const opportunities = [
  { number: '01', title: 'Студентам', text: 'Работать над практическими ИТ-задачами и видеть, как проект развивается от идеи до результата.' },
  { number: '02', title: 'Университету', text: 'Сопровождать проектную деятельность и сохранять общую картину работы команд.' },
  { number: '03', title: 'Компаниям', text: 'Формулировать задачи для совместной работы с университетскими командами.' }
];

const directions = ['Разработка цифровых продуктов', 'Данные и аналитика', 'Искусственный интеллект', 'Интерфейсы и пользовательский опыт', 'Инженерные ИТ-решения'];

export function HomePage() {
  return <>
    <PublicHeader />
    <main>
      <section className="hero"><div className="container hero__grid">
        <div className="hero__copy"><span className="eyebrow">Уфимский университет науки и технологий</span><h1>Идеи встречаются<br />с <em>практикой.</em></h1>
          <p className="hero__lead">Витрина ИТ-проектов объединяет студентов, университет и компании вокруг задач, которые интересно решать вместе.</p>
          <div className="hero__actions"><a className="button button--primary" href="#projects">Посмотреть примеры <span aria-hidden="true">↗</span></a><a className="text-link" href="#about">Как устроена платформа <span aria-hidden="true">→</span></a></div>
        </div>
        <div className="hero__visual" aria-hidden="true"><div className="hero__visual-top"><span>УНИВЕРСИТЕТ · КОМАНДА · ПАРТНЁР</span><span>01 / 03</span></div><div className="hero__visual-main"><div className="orbit orbit--one"/><div className="orbit orbit--two"/><div className="hero__visual-center">ИТ<br /><small>проекты</small></div><span className="visual-label visual-label--a">Исследовать</span><span className="visual-label visual-label--b">Создавать</span><span className="visual-label visual-label--c">Развивать</span></div><div className="hero__visual-bottom">Пространство совместной проектной работы <span>↗</span></div></div>
      </div></section>
      <section id="about" className="section about-section"><div className="container"><div className="section-heading"><span className="eyebrow">О платформе</span><h2>От учебной задачи — к совместному проекту</h2><p>Здесь проектная работа получает понятный контекст: кто участвует, какую задачу решает команда и как меняется результат.</p></div><div className="opportunities">{opportunities.map((item) => <div className="opportunity" key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></div>)}</div></div></section>
      <section id="directions" className="section directions-section"><div className="container directions-grid"><div className="section-heading"><span className="eyebrow">Направления</span><h2>Разные задачи. Общий язык технологий.</h2><p>Направления помогают увидеть, в каких областях может развиваться проектная работа.</p></div><div className="direction-list">{directions.map((item, index) => <div className="direction-item" key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong><span aria-hidden="true">↗</span></div>)}</div></div></section>
      <section id="projects" className="section projects-section"><div className="container"><div className="projects-heading"><div className="section-heading"><span className="eyebrow">Возможные проекты</span><h2>Как это может выглядеть</h2><p>Ниже — демонстрационные примеры. Они показывают формат будущей витрины и не являются опубликованными проектами.</p></div><Badge tone="brand">Демонстрационный режим</Badge></div><div className="project-grid">{demoProjects.map((project, index) => <Card className="project-card" key={project.title}><div className="project-card__top"><span>ПРИМЕР / {String(index + 1).padStart(2, '0')}</span><span aria-hidden="true">↗</span></div><h3>{project.title}</h3><p>{project.summary}</p><Badge>{project.direction}</Badge></Card>)}</div></div></section>
      <section className="cta-section"><div className="container cta-inner"><div><span className="eyebrow">УУНиТ · ИТ-проекты</span><h2>Создаём основу для совместной работы.</h2><p>Платформа развивается. Следите за появлением проектных разделов и новых возможностей.</p></div><ButtonLink to="/university" variant="secondary">Посмотреть структуру кабинета <span aria-hidden="true">↗</span></ButtonLink></div></section>
    </main>
    <footer className="footer"><div className="container footer__inner"><span>© {new Date().getFullYear()} Уфимский университет науки и технологий</span><a href="https://uust.ru/" target="_blank" rel="noreferrer">Официальный сайт УУНиТ ↗</a></div></footer>
  </>;
}
