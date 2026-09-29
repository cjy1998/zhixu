import { api, setToken } from './client';
import { streamSse, type SseHandlers } from './sse';
import { mockServer } from '../mock/server';
import type {
  AnswerResult,
  AssessmentHistoryItem,
  CreateTopicResult,
  HeatmapDay,
  NodeDTO,
  ResourceDTO,
  ReviewResult,
  Roadmap,
  StageProgress,
  StatsOverview,
  SubmitResult,
  TopicDetail,
  TopicSummary,
  User,
} from './types';

export const USE_MOCK: boolean = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const backend = {
  register(input: { name: string; email: string; password: string }): Promise<{ user: User }> {
    if (USE_MOCK) return mockServer.register(input);
    return api('/auth/register', { method: 'POST', body: input, auth: false });
  },

  async login(input: { email: string; password: string }): Promise<User> {
    const data = USE_MOCK
      ? await mockServer.login(input)
      : await api<{ token: string; expiresIn: number; user: User }>('/auth/login', {
          method: 'POST',
          body: input,
          auth: false,
        });
    setToken(data.token);
    return data.user;
  },

  me(): Promise<User> {
    if (USE_MOCK) return mockServer.me();
    return api('/me');
  },

  listTopics(): Promise<{ items: TopicSummary[] }> {
    if (USE_MOCK) return mockServer.listTopics();
    return api('/topics');
  },

  getTopic(topicId: number): Promise<TopicDetail> {
    if (USE_MOCK) return mockServer.getTopic(topicId);
    return api(`/topics/${topicId}`);
  },

  createTopic(roadmap: Roadmap): Promise<CreateTopicResult> {
    if (USE_MOCK) return mockServer.createTopic(roadmap);
    return api('/topics', { method: 'POST', body: roadmap });
  },

  generateRoadmap(
    input: { title: string; level: string; goal: string; hoursPerWeek: number },
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<Roadmap> {
    if (USE_MOCK) return mockServer.generateRoadmap(input, handlers, signal);
    return streamSse('/ai/roadmap', input, handlers, signal);
  },

  addNode(
    topicId: number,
    body: { parentId: number | null; stageIndex: number; title: string; objective: string; durationMinutes: number },
  ): Promise<NodeDTO> {
    if (USE_MOCK) return mockServer.addNode(topicId, body);
    return api(`/topics/${topicId}/nodes`, { method: 'POST', body });
  },

  patchNode(
    nodeId: number,
    patch: { title?: string; objective?: string; durationMinutes?: number },
  ): Promise<NodeDTO & { revisionChanged: boolean; parentAffected: number[] }> {
    if (USE_MOCK) return mockServer.patchNode(nodeId, patch);
    return api(`/nodes/${nodeId}`, { method: 'PATCH', body: patch });
  },

  reorderNodes(
    topicId: number,
    body: { groupId: { parentId: number | null; stageIndex: number }; order: number[] },
  ): Promise<{ updated: number }> {
    if (USE_MOCK) return mockServer.reorderNodes(topicId, body);
    return api(`/topics/${topicId}/nodes/reorder`, { method: 'POST', body });
  },

  deleteNode(nodeId: number): Promise<{ deleted: { nodeId: number; subtreeCount: number } }> {
    if (USE_MOCK) return mockServer.deleteNode(nodeId);
    return api(`/nodes/${nodeId}`, { method: 'DELETE' });
  },

  undoDelete(topicId: number): Promise<{ restored: number[] }> {
    if (USE_MOCK) return mockServer.undoDelete(topicId);
    return api(`/topics/${topicId}/undo`, { method: 'POST' });
  },

  startQuiz(
    nodeId: number,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<{ assessment: { id: number; nodeId: number; topicId: number; revision: number; status: string; questions: unknown[] } }> {
    if (USE_MOCK) return mockServer.startQuiz(nodeId, handlers, signal) as Promise<never>;
    return streamSse(`/nodes/${nodeId}/quiz`, {}, handlers, signal) as Promise<never>;
  },

  answer(
    assessmentId: number,
    body: { questionIndex: number; answer: number | string },
  ): Promise<AnswerResult> {
    if (USE_MOCK) return mockServer.answer(assessmentId, body);
    return api(`/assessments/${assessmentId}/answer`, { method: 'POST', body });
  },

  submit(assessmentId: number): Promise<SubmitResult> {
    if (USE_MOCK) return mockServer.submit(assessmentId);
    return api(`/assessments/${assessmentId}/submit`, { method: 'POST' });
  },

  listAssessments(params: { limit?: number; cursor?: number } = {}): Promise<{
    items: AssessmentHistoryItem[];
    nextCursor: number | null;
  }> {
    if (USE_MOCK) return mockServer.listAssessments(params);
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', String(params.cursor));
    return api(`/me/assessments${query.size ? `?${query}` : ''}`);
  },

  getNote(nodeId: number): Promise<{ content: string; updatedAt: string } | null> {
    if (USE_MOCK) return mockServer.getNote(nodeId);
    return api(`/nodes/${nodeId}/note`);
  },

  putNote(nodeId: number, content: string): Promise<{ updatedAt: string }> {
    if (USE_MOCK) return mockServer.putNote(nodeId, { content });
    return api(`/nodes/${nodeId}/note`, { method: 'PUT', body: { content } });
  },

  listResources(nodeId: number): Promise<{ items: ResourceDTO[] }> {
    if (USE_MOCK) return mockServer.listResources(nodeId);
    return api(`/nodes/${nodeId}/resources`);
  },

  addResource(
    nodeId: number,
    body: { type: string; title: string; url: string },
  ): Promise<ResourceDTO> {
    if (USE_MOCK) return mockServer.addResource(nodeId, body);
    return api(`/nodes/${nodeId}/resources`, { method: 'POST', body });
  },

  deleteResource(resourceId: number): Promise<null> {
    if (USE_MOCK) return mockServer.deleteResource(resourceId);
    return api(`/resources/${resourceId}`, { method: 'DELETE' });
  },

  statsOverview(): Promise<StatsOverview & { todayChecked?: boolean }> {
    if (USE_MOCK) return mockServer.statsOverview();
    return api('/stats/overview');
  },

  statsHeatmap(from: string, to: string): Promise<{ days: HeatmapDay[] }> {
    if (USE_MOCK) return mockServer.statsHeatmap({ from, to });
    return api(`/stats/heatmap?from=${from}&to=${to}`);
  },

  topicProgress(topicId: number): Promise<{ stages: StageProgress[] }> {
    if (USE_MOCK) return mockServer.topicProgress(topicId);
    return api(`/topics/${topicId}/progress`);
  },

  stageReview(
    topicId: number,
    stageIndex: number,
    handlers: SseHandlers,
    signal?: AbortSignal,
  ): Promise<ReviewResult> {
    if (USE_MOCK) return mockServer.stageReview(topicId, stageIndex, handlers, signal);
    return streamSse(`/topics/${topicId}/stages/${stageIndex}/review`, {}, handlers, signal) as Promise<never>;
  },
};
