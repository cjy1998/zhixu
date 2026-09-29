export type NodeStatus = 'idle' | 'active' | 'pending' | 'done' | 'failed';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
}

export interface TopicSummary {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  color: 'purple' | 'gold' | 'blue' | 'green' | 'mint' | string;
  estimatedWeeks: number;
  weeklyHours: number;
  leafTotal: number;
  leafDone: number;
  percent: number;
  nextNodeTitle: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface TopicDetail {
  topic: TopicSummary & {
    summary: string;
    stageTitles: string[];
    stageWeeks: string[];
    level?: string;
  };
  nodes: NodeDTO[];
}

export interface NodeDTO {
  id: number;
  topicId: number;
  parentId: number | null;
  stageIndex: number;
  level: number;
  orderNo: number;
  title: string;
  objective: string;
  durationMinutes: number;
  status: NodeStatus;
  revision: number;
  hasPassedRecord: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapStageNode {
  ref: string;
  parentRef: string | null;
  title: string;
  objective: string;
  durationMinutes: number;
}

export interface RoadmapStage {
  title: string;
  weekRange: string;
  goal: string;
  nodes: RoadmapStageNode[];
}

export interface Roadmap {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  estimatedWeeks: number;
  weeklyHours: number;
  summary: string;
  stages: RoadmapStage[];
}

export type QuizQuestion =
  | { type: 'choice'; prompt: string; options: string[] }
  | { type: 'concept'; prompt: string; minLength: number }
  | { type: 'code'; prompt: string; language: string; starterCode: string | null };

export interface AssessmentView {
  id: number;
  nodeId: number;
  topicId: number;
  revision: number;
  status: 'in_progress' | 'finished';
  questions: QuizQuestion[];
}

export interface ChoiceAnswerResult {
  questionIndex: number;
  type: 'choice';
  correct: boolean;
  answerIndex: number;
  explanation: string;
}

export interface GradedAnswerResult {
  questionIndex: number;
  type: 'concept' | 'code';
  passed: boolean;
  score: number;
  gradedBy: string;
  feedback: string;
  missingPoints: string[];
  wrongPoints: string[];
  suggestions: string[];
  strengths: string[];
}

export type AnswerResult = ChoiceAnswerResult | GradedAnswerResult;

export interface SubmitResult {
  assessmentId: number;
  passed: boolean;
  passedCount: number;
  total: number;
  nodeStatus: NodeStatus;
  checkIn: { id: number; checkDate: string } | null;
  streak: number;
  canRetake: boolean;
  nextNode: { id: number; title: string } | null;
}

export interface StatsOverview {
  topicsCount: number;
  passedTotal: number;
  weeklyTarget: { passed: number; goal: number; percent: number };
  todayPassed: number;
  streak: number;
  longestStreak: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface StageProgress {
  index: number;
  title: string;
  weekRange: string;
  leafTotal: number;
  leafDone: number;
  percent: number;
  allDone: boolean;
}

export interface AssessmentHistoryItem {
  id: number;
  nodeId: number;
  nodeTitle: string;
  topicId: number;
  revision: number;
  status: 'in_progress' | 'finished';
  passed: boolean;
  passedCount: number;
  objective?: string;
  finishedAt: string;
  isStale: boolean;
}

export type ResourceType = 'link' | 'video' | 'book' | 'paper' | 'document' | string;

export interface ResourceDTO {
  id: number;
  nodeId: number;
  type: ResourceType;
  title: string;
  url: string;
  createdAt: string;
}

export interface ReviewResult {
  stageTitle: string;
  summary: { text: string; abilityRating: number };
  mastered: { point: string; evidence: string }[];
  needsAttention: { point: string; reason: string }[];
  nextStep: { action: string; reason: string }[];
}

export interface ReviewRecord extends ReviewResult {
  id: number;
  topicId: number;
  stageIndex: number;
  createdAt: string;
}

export interface ProgressEvent {
  step: string;
  message: string;
  percent: number;
}

export interface UsageEvent {
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

export interface CreateTopicResult {
  topic: { id: number; title: string };
  nodes: NodeDTO[];
}

export interface ApiEnvelope<T> {
  code: number | string;
  message: string;
  data: T;
}
