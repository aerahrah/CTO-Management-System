// src/hooks/useUrlDetails.js
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

/*
 * Keeps "which record's details modal is open" in the URL (?app=<id>), so:
 *   - the browser Back button closes the modal instead of leaving the page,
 *   - a refresh keeps the modal open,
 *   - a link (e.g. from a notification) opens that record directly.
 *
 * The record is looked up in the list the page already loaded. If it isn't
 * there (another page, another filter) and `fetchById` is given, it is
 * fetched on its own. If it can't be found at all, the param is removed and
 * `onMissing` is called.
 *
 * Usage:
 *   const details = useUrlDetails({
 *     param: "app",
 *     items: applications,
 *     ready: isSuccess,
 *     fetchById: async (id) => (await fetchCtoApplicationById(id))?.application,
 *     onMissing: () => toast.info("That application couldn't be found."),
 *   });
 *   details.open(app)    // from a row click / "View Details"
 *   details.close()      // from the modal's onClose
 *   details.isOpen, details.selected (null while loading)
 *   details.display      // selected, or the last record while closing
 */

const PUSHED_KEY = "__urlDetailsPushed";

const idOf = (item) => {
  const id = item?._id ?? item?.id;
  return id == null ? null : String(id);
};

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export default function useUrlDetails({
  param = "view",
  items,
  ready = true,
  fetchById,
  queryKey = "url-details",
  onMissing,
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const openId = useMemo(
    () => new URLSearchParams(location.search).get(param) || null,
    [location.search, param],
  );

  // The last record shown. Keeps the modal filled while the list changes page,
  // refetches, or stops containing the record.
  const lastShownRef = useRef(null);

  const fromList = useMemo(() => {
    if (!openId || !Array.isArray(items)) return null;
    return items.find((item) => idOf(item) === openId) ?? null;
  }, [items, openId]);

  const remembered =
    openId && idOf(lastShownRef.current) === openId
      ? lastShownRef.current
      : null;

  const canFetch = typeof fetchById === "function";

  const detailQuery = useQuery({
    queryKey: [queryKey, param, openId],
    queryFn: async () => (await fetchById(openId)) ?? null,
    enabled: !!openId && !fromList && !remembered && ready && canFetch,
    retry: false,
    staleTime: 30_000,
  });

  const fetched = openId ? (detailQuery.data ?? null) : null;
  const selected = fromList ?? remembered ?? fetched;

  useEffect(() => {
    if (selected) lastShownRef.current = selected;
  }, [selected]);

  const isMissing =
    !!openId &&
    !selected &&
    ready &&
    (!canFetch ||
      detailQuery.isError ||
      (detailQuery.isSuccess && !detailQuery.data));

  /* ---------- open / close ---------- */

  // Guards against a double close (Esc + backdrop in the same tick) stepping
  // back twice in history.
  const closingRef = useRef(false);
  useEffect(() => {
    closingRef.current = false;
  }, [location.key]);

  const open = useCallback(
    (item) => {
      const id = idOf(item);
      if (!id) return;
      lastShownRef.current = item;

      const params = new URLSearchParams(location.search);
      const current = params.get(param);
      if (current === id) return;
      params.set(param, id);

      const to = {
        pathname: location.pathname,
        search: `?${params}`,
        hash: location.hash,
      };

      if (current) {
        // Switching records: don't stack history entries.
        navigate(to, {
          replace: true,
          state: location.state,
          preventScrollReset: true,
        });
      } else {
        navigate(to, {
          state: { ...asObject(location.state), [PUSHED_KEY]: true },
          preventScrollReset: true,
        });
      }
    },
    [location, navigate, param],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has(param) || closingRef.current) return;
    closingRef.current = true;

    // We pushed this entry ourselves, so the one before it is the list
    // without the modal: going back keeps Back/Forward in sync.
    if (asObject(location.state)[PUSHED_KEY]) {
      navigate(-1);
      return;
    }

    // Opened from a link or a fresh tab: just drop the param.
    params.delete(param);
    const search = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: search ? `?${search}` : "",
        hash: location.hash,
      },
      { replace: true, state: location.state, preventScrollReset: true },
    );
  }, [location, navigate, param]);

  /* ---------- record not found ---------- */

  const onMissingRef = useRef(onMissing);
  useEffect(() => {
    onMissingRef.current = onMissing;
  });

  const missingHandledRef = useRef(null);
  useEffect(() => {
    if (!openId) {
      missingHandledRef.current = null;
      return;
    }
    if (!isMissing || missingHandledRef.current === openId) return;
    missingHandledRef.current = openId;
    onMissingRef.current?.(openId);
    close();
  }, [isMissing, openId, close]);

  return {
    openId,
    isOpen: !!openId,
    selected,
    // What to render: the open record, or the last one while the modal is
    // closing (keeps an exit animation from flashing empty).
    display: openId ? selected : lastShownRef.current,
    isLoading: !!openId && !selected && !isMissing,
    open,
    close,
  };
}
