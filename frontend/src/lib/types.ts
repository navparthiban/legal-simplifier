export interface Question {
  question: string;
  options: string[];
  /** zero-based index of the correct option */
  correct: number;
}

export interface Risk {
  title?: string;
  description?: string;
}

export interface SummaryData {
  title?: string;
  parties?: string;
  obligations?: string[];
  deadlines?: string[];
  rights?: string[];
  risks?: Risk[];
}

/** In-progress value pulled out of a partial streamed JSON string. */
export interface PartialStr {
  value: string;
  complete: boolean;
}

export interface StreamingPartial {
  title: PartialStr | null;
  parties: PartialStr | null;
  obligations: string[] | null;
  deadlines: string[] | null;
  rights: string[] | null;
  risks: Risk[] | null;
}
