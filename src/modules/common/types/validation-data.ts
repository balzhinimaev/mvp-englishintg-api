export interface ChoiceValidationData {
  options: string[];
  correctIndex: number;
}

export interface GapValidationData {
  answer: string;
  alternatives?: string[];
}

export interface OrderValidationData {
  tokens: string[];
}

export interface TranslateValidationData {
  expected: string[];
}

export interface AudioValidationData {
  target?: string;
}

export type TaskValidationData =
  | ChoiceValidationData
  | GapValidationData
  | OrderValidationData
  | TranslateValidationData
  | AudioValidationData;
