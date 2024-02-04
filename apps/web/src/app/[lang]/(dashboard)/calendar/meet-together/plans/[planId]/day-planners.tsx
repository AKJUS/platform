import DayPlanner from './day-planner';
import { useTimeBlocking } from './time-blocking-provider';

export default function DayPlanners({
  dates,
  start,
  end,
  editable,
  disabled,
}: {
  dates: string[];
  start: number;
  end: number;
  editable: boolean;
  disabled: boolean;
}) {
  const { endEditing } = useTimeBlocking();

  return (
    <div
      className="flex items-start justify-center gap-2"
      onMouseLeave={endEditing}
    >
      {dates.map((d) => (
        <DayPlanner
          key={d}
          date={d}
          start={start}
          end={end}
          editable={editable}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
