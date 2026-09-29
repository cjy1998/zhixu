import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { backend } from '../api';
import type { TopicDetail, TopicSummary } from '../api/types';

interface TopicsContextValue {
  summaries: TopicSummary[];
  details: Record<number, TopicDetail>;
  activeTopicId: number | null;
  activeDetail: TopicDetail | null;
  loading: boolean;
  refreshSummaries: () => Promise<void>;
  loadDetail: (topicId: number, force?: boolean) => Promise<TopicDetail>;
  invalidateDetail: (topicId: number) => void;
  reloadAll: () => Promise<void>;
  setActiveTopic: (topicId: number) => void;
}

const TopicsContext = createContext<TopicsContextValue | null>(null);

export function useTopics() {
  const context = useContext(TopicsContext);
  if (!context) throw new Error('useTopics 必须在 TopicsProvider 内使用');
  return context;
}

const ACTIVE_KEY = 'zhixu-web-active-topic';

export function TopicsProvider({ children }: { children: ReactNode }) {
  const [summaries, setSummaries] = useState<TopicSummary[]>([]);
  const [details, setDetails] = useState<Record<number, TopicDetail>>({});
  const [activeTopicId, setActiveTopicIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? Number(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const refreshSummaries = useCallback(async () => {
    const { items } = await backend.listTopics();
    setSummaries(items);
    return undefined;
  }, []);

  const loadDetail = useCallback(async (topicId: number) => {
    setLoading(true);
    try {
      const detail = await backend.getTopic(topicId);
      setDetails((prev) => ({ ...prev, [topicId]: detail }));
      return detail;
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateDetail = useCallback((topicId: number) => {
    setDetails((prev) => {
      if (!(topicId in prev)) return prev;
      const next = { ...prev };
      delete next[topicId];
      return next;
    });
  }, []);

  const reloadAll = useCallback(async () => {
    await refreshSummaries();
    const ids = Object.keys(details).map(Number);
    for (const id of ids) {
      await backend.getTopic(id).then((detail) => {
        setDetails((prev) => ({ ...prev, [id]: detail }));
      });
    }
  }, [details, refreshSummaries]);

  const setActiveTopic = useCallback((topicId: number) => {
    localStorage.setItem(ACTIVE_KEY, String(topicId));
    setActiveTopicIdState(topicId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await backend.listTopics();
        if (!cancelled) {
          setSummaries(items);
          setActiveTopicIdState((current) => {
            if (current && items.some((t) => t.id === current)) return current;
            const stored = localStorage.getItem(ACTIVE_KEY);
            if (stored && items.some((t) => t.id === Number(stored))) return Number(stored);
            return items[0]?.id ?? null;
          });
        }
      } catch {
        if (!cancelled) setSummaries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<TopicsContextValue>(
    () => ({
      summaries,
      details,
      activeTopicId,
      activeDetail: activeTopicId ? details[activeTopicId] ?? null : null,
      loading,
      refreshSummaries,
      loadDetail,
      invalidateDetail,
      reloadAll,
      setActiveTopic,
    }),
    [summaries, details, activeTopicId, loading, refreshSummaries, loadDetail, invalidateDetail, reloadAll, setActiveTopic],
  );

  return <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>;
}
