import React from 'react';
import { WorklogTaskRow } from '../../components';
import type { ClientTaskGroup } from '../../model';

type GroupCardProps = {
  group: ClientTaskGroup;
  cardClassName: string;
  headerClassName: string;
  countBadgeClassName: string;
};

export function GroupCard({ group, cardClassName, headerClassName, countBadgeClassName }: GroupCardProps) {
  return (
    <div key={group.id} className={cardClassName}>
      <div className={headerClassName}>
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: group.color }} />
        <span className="font-bold text-[14.5px]">{group.name}</span>
        <span className={countBadgeClassName}>{group.count}</span>
      </div>
      <div className="px-2 py-[6px]">{group.rows.map((row) => <WorklogTaskRow key={row.id} row={row} />)}</div>
    </div>
  );
}
