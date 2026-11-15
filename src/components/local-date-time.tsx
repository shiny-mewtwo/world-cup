"use client";

import { useMemo, useSyncExternalStore } from "react";

import { formatLocalDateTime } from "@/lib/formatting";

type LocalDateTimeProps = {
  isoDate: string;
  includeWeekday?: boolean;
};

const subscribe = () => () => {};
const getServerTimeZone = () => null;
const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function LocalDateTime({ isoDate, includeWeekday }: LocalDateTimeProps) {
  const timeZone = useSyncExternalStore(
    subscribe,
    getBrowserTimeZone,
    getServerTimeZone,
  );

  const formatted = useMemo(
    () => {
      if (!timeZone) {
        return null;
      }

      return formatLocalDateTime(new Date(isoDate), {
        includeWeekday,
        timeZone,
      });
    },
    [includeWeekday, isoDate, timeZone],
  );

  return (
    <time className="local-date-time" dateTime={isoDate} suppressHydrationWarning>
      {formatted ?? "\u00a0"}
    </time>
  );
}
