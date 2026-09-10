import { useEffect, useState } from "react";
import { getGraph, getInfluencers, type GraphEdge, type Influencer } from "./aiService";
import { getGraphViaBackend, getInfluencersViaBackend, getToken } from "./backend";
import { toUiGraph, toUiInfluencers, type UiEdge, type UiInfluencer, type UiNode } from "./graphAdapter";

export type CaseGraphState = {
  nodes: UiNode[];
  edges: UiEdge[];
  influencers: UiInfluencer[];
  loading: boolean;
  error: string | null;
  /** false when the panel is showing sample data instead of service data. */
  isLive: boolean;
};

/**
 * Loads a case graph from the AI service.
 *
 * The service currently holds no graph for the seeded case ids, so a
 * successful-but-empty response falls back to `fallback` rather than rendering
 * an empty canvas. `isLive` tells the UI which it is looking at, so the
 * distinction is visible instead of silently misleading.
 */
export function useCaseGraph(
  caseId: string,
  fallback: { nodes: UiNode[]; edges: UiEdge[]; influencers: UiInfluencer[] },
): CaseGraphState {
  const [state, setState] = useState<CaseGraphState>({
    ...fallback,
    loading: true,
    error: null,
    isLive: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        // Prefer the backend's proxy when signed in.
        //
        // Evidence uploaded through POST /api/ingest/upload reaches the AI
        // service with case_id set to the case UUID, so the graph is keyed by
        // UUID. The backend's /api/graph/{caseId} proxy uses the same UUID, and
        // routing through it means only the backend's CORS allowlist matters.
        //
        // Without a token the proxy would 403, so fall back to querying the AI
        // service directly - useful for graphs seeded by direct ingestion.
        const viaBackend = Boolean(getToken());

        // The backend proxy returns the AI service's body unchanged, so the
        // shapes match - it just types the passthrough as unknown[].
        const [graphRes, inflRes] = viaBackend
          ? await Promise.all([getGraphViaBackend(caseId), getInfluencersViaBackend(caseId)])
          : await Promise.all([getGraph(caseId), getInfluencers(caseId, 5)]);
        if (cancelled) return;

        const { nodes, edges } = toUiGraph((graphRes.graph ?? []) as GraphEdge[]);
        if (nodes.length === 0) {
          setState({ ...fallback, loading: false, error: null, isLive: false });
          return;
        }
        setState({
          nodes,
          edges,
          influencers: toUiInfluencers((inflRes.influencers ?? []) as Influencer[]),
          loading: false,
          error: null,
          isLive: true,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          ...fallback,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load graph",
          isLive: false,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  return state;
}
