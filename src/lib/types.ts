export type ID = string;

export interface Base {
  id: ID;
  created_at?: string;
}

export type EventKind = "pruefung" | "testat" | "frist" | "veranstaltung" | "sonstiges";

export interface StudyEvent extends Base {
  title: string;
  kind: EventKind;
  starts_at: string;
  location: string | null;
  subject_id: ID | null;
  notes: string | null;
  progress: number;
  done: boolean;
  /** Optional end; for all-day events the last day (inclusive). */
  ends_at?: string | null;
  /** All-day events are stored at local midnight of their first day. */
  all_day?: boolean;
  /** Where a suggested event came from, e.g. "mhh:quintil:2026-2"; keeps suggestions from coming back. */
  source?: string | null;
}

export interface FeedFilter {
  /** Empty or missing means all kinds. */
  kinds?: EventKind[];
  /** Subject ids; empty or missing means all, "none" stands for events without a subject. */
  subjects?: string[];
  /** Leave out events marked as done. */
  hideDone?: boolean;
}

export interface CalendarFeed extends Base {
  token: string;
  name: string;
  filter: FeedFilter;
}

export interface Todo extends Base {
  title: string;
  due_date: string | null;
  priority: 1 | 2 | 3;
  subject_id: ID | null;
  notes: string | null;
  done: boolean;
}

export interface LinkItem extends Base {
  title: string;
  url: string;
  category: string;
  description: string | null;
}

export interface Subject extends Base {
  name: string;
  color: string;
}

export interface Topic extends Base {
  subject_id: ID;
  parent_id: ID | null;
  name: string;
  sort: number;
}

export type QuestionType = "mc" | "explain" | "occlusion";

export interface McOption {
  text: string;
  correct: boolean;
}

/** FSRS card state as stored in the database (dates as ISO strings). */
export interface CardJson {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
}

export interface Question extends Base {
  topic_id: ID;
  type: QuestionType;
  prompt: string;
  options: McOption[];
  answer: string | null;
  explanation: string | null;
  image_url: string | null;
  video_url: string | null;
  source: string | null;
  suspended: boolean;
  card: CardJson | null;
  due: string | null;
  /** Only for type "occlusion": the figure and the mask this question asks about. */
  figure_id?: ID | null;
  mask_id?: string | null;
  /** 1 = coarse … 3 = fine; finer masks of a figure open once the coarser ones are learned. */
  level?: number | null;
}

/** A covered structure on a figure; coordinates are fractions of the image size. */
export interface Mask {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  level: number;
}

export interface Figure extends Base {
  topic_id: ID;
  title: string;
  /** Storage path in the "figures" bucket, or a data URL in demo mode. */
  image: string;
  masks: Mask[];
  /** Cover every mask while asking, not just the one in question. */
  hide_all: boolean;
}

export interface Expense extends Base {
  /** YYYY-MM-DD; the calendar year decides the tax year. */
  date: string;
  title: string;
  /** Euro, gross. Supabase returns numeric columns as numbers or strings, so read it with Number(). */
  amount: number;
  category: string;
  note: string | null;
  /** Storage path in the "receipts" bucket, or a data URL in demo mode. */
  receipt: string | null;
  receipt_name: string | null;
}

export interface Review extends Base {
  question_id: ID;
  topic_id: ID;
  rating: 1 | 2 | 3 | 4;
  correct: boolean;
  reviewed_at: string;
  duration_ms: number;
}

export interface Settings extends Base {
  daily_new_limit: number;
  desired_retention: number;
  gating_enabled: boolean;
  unlock_threshold: number;
}

export interface Note extends Base {
  title: string;
  body: string;
  pinned: boolean;
}

export type MelvinCategory = "privat" | "arbeit" | "sport" | "familie" | "sonstiges";

export interface MelvinEvent extends Base {
  title: string;
  category: MelvinCategory;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  done: boolean;
}

export interface MelvinTodo extends Base {
  title: string;
  due_date: string | null;
  priority: 1 | 2 | 3;
  category: string | null;
  notes: string | null;
  done: boolean;
}

export type Interval = "monatlich" | "vierteljaehrlich" | "halbjaehrlich" | "jaehrlich";

export interface FinanceEntry extends Base {
  title: string;
  kind: "einnahme" | "ausgabe";
  /** Euro. Supabase returns numeric columns as numbers or strings, so read it with Number(). */
  amount: number;
  /** Fixed entries repeat every interval from date on, until end_date; variable ones happen once on date. */
  fixed: boolean;
  interval: Interval | null;
  /** YYYY-MM-DD */
  date: string;
  end_date: string | null;
  category: string;
  note: string | null;
}

export type ContractKind = "versicherung" | "abo" | "vertrag" | "sonstiges";

export interface ContractLink {
  label: string;
  url: string;
}

export interface Contract extends Base {
  title: string;
  kind: ContractKind;
  provider: string | null;
  amount: number | null;
  interval: Interval | "einmalig" | null;
  contract_no: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Last day to cancel. */
  cancel_by: string | null;
  /** Notice period as written in the contract, e.g. "3 Monate zum Laufzeitende". */
  notice: string | null;
  url: string | null;
  links: ContractLink[];
  notes: string | null;
  /** Count the costs as fixed costs in Finanzen. */
  in_finances: boolean;
}

export type CalendarSource = "studium" | "melvin" | "batzis";

/** Two dates in different calendars that are kept in step (see supabase/migrations/0010_event_links.sql). */
export interface EventLink extends Base {
  a_kind: CalendarSource;
  a_id: ID;
  a_user: ID | null;
  b_kind: CalendarSource;
  b_id: ID;
  b_user: ID | null;
}

/** A date in the shared calendar of the Batzi's: a day plus optional times in German time. */
export interface BatziEvent extends Base {
  title: string;
  event_date: string;
  end_date: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  who: string | null;
  color: string;
  recurrence: "none" | "weekly" | "biweekly" | "monthly" | "yearly";
}

export interface Tables {
  events: StudyEvent;
  todos: Todo;
  links: LinkItem;
  subjects: Subject;
  topics: Topic;
  figures: Figure;
  questions: Question;
  reviews: Review;
  expenses: Expense;
  calendar_feeds: CalendarFeed;
  settings: Settings;
  notes: Note;
  melvin_events: MelvinEvent;
  melvin_todos: MelvinTodo;
  finance_entries: FinanceEntry;
  contracts: Contract;
  event_links: EventLink;
  batzi_events: BatziEvent;
}

export type TableName = keyof Tables;

/** Tables in the backup, parents first. Calendar feeds are left out: their links are secrets of one account. */
export const TABLES: TableName[] = [
  "subjects",
  "topics",
  "figures",
  "questions",
  "reviews",
  "events",
  "todos",
  "links",
  "expenses",
  "settings",
  "notes",
];
