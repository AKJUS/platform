import type dayjs from 'dayjs';

export interface DateRange {
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
}

export interface Event {
  id: string;
  name: string;
  range: DateRange;
  isPastDeadline?: boolean;
  taskId: string;
  partNumber?: number;
  totalParts?: number;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  locked?: boolean;
  category?: 'work' | 'personal' | 'meeting';
}

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  name: string;
  duration: number;
  minDuration: number;
  maxDuration: number;
  category: 'work' | 'personal' | 'meeting';
  priority: TaskPriority;
  events: Event[];
  deadline?: dayjs.Dayjs;
  taskId?: string;
  allowSplit?: boolean;
}

export interface ActiveHours {
  personal: DateRange[];
  work: DateRange[];
  meeting: DateRange[];
}

export interface Log {
  type: 'warning' | 'error';
  message: string;
}

export interface ScheduleResult {
  events: Event[];
  logs: Log[];
}

export interface TemplateScenario {
  name: string;
  description: string;
  tasks: Task[];
  activeHours?: Partial<ActiveHours>;
}
