import type { ReactNode } from 'react';

type StateProps = { title: string; description?: string; action?: ReactNode };
function State({ title, description, action, symbol }: StateProps & { symbol: string }) {
  return <div className="state" role="status"><span className="state__symbol" aria-hidden="true">{symbol}</span><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>;
}
export function EmptyState(props: StateProps) { return <State symbol="○" {...props} />; }
export function LoadingState({ title = 'Загрузка данных' }: { title?: string }) { return <State symbol="◌" title={title} />; }
export function ErrorState(props: StateProps) { return <State symbol="!" {...props} />; }
