import type { AlertTone } from '@/types';

interface AlertProps {
  tone: AlertTone;
  icon: string;
  title: string;
  body: string;
  id?: string;
}

export default function Alert({ tone, icon, title, body, id }: AlertProps) {
  return (
    <div className={`alert al-${tone}`} id={id}>
      <i className={`ti ${icon}`}></i>
      <div>
        <div className="al-t">{title}</div>
        <div className="al-b">{body}</div>
      </div>
    </div>
  );
}
