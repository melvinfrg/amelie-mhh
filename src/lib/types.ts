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

export type QuestionType = "mc" | "explain";

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

export interface Tables {
  events: StudyEvent;
  todos: Todo;
  links: LinkItem;
  subjects: Subject;
  topics: Topic;
  questions: Question;
  reviews: Review;
  settings: Settings;
}

export type TableName = keyof Tables;

export const TABLES: TableName[] = [
  "subjects",
  "topics",
  "questions",
  "reviews",
  "events",
  "todos",
  "links",
  "settings",
];
