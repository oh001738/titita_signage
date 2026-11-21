"use client";
import { useEffect, useRef, useState } from "react";

// The text remains in the DOM for measurement even when a static page is shown.
export function AnnouncementText({
  body,
  paused,
  reducedMotion,
  onComplete,
}: {
  body: string;
  paused: boolean;
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const measureText = useRef<HTMLElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const [widths, setWidths] = useState({ text: 0, container: 0 });
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  useEffect(() => {
    const measure = () => {
      const outer = container.current,
        text = measureText.current;
      if (!outer || !text || !outer.clientWidth) return;
      const width = outer.clientWidth;
      const textWidth = text.getBoundingClientRect().width;
      setWidths((previous) =>
        previous.text === textWidth && previous.container === width
          ? previous
          : { text: textWidth, container: width },
      );
      if (!reducedMotion) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const style = getComputedStyle(text);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const groups: string[] = [];
      let line = "";
      for (const char of Array.from(body)) {
        if (
          line &&
          (char === "\n" || context.measureText(line + char).width > width - 3)
        ) {
          groups.push(line);
          line = char === "\n" ? "" : char;
        } else if (char !== "\n") line += char;
      }
      if (line || !groups.length) groups.push(line);
      setPages((previous) =>
        previous.join("\0") === groups.join("\0") ? previous : groups,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    if (measureText.current) observer.observe(measureText.current);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [body, reducedMotion]);
  useEffect(() => {
    setPage(0);
  }, [body, widths.container, reducedMotion]);
  const overflow = widths.text > widths.container;
  const duration = Math.max(8, (widths.text + widths.container) / 45);
  useEffect(() => {
    if (paused || !widths.container || (reducedMotion && !pages.length)) return;
    const delay =
      reducedMotion || !overflow
        ? 10000
        : Math.max(10000, duration * 1000 + 2000);
    const timer = setTimeout(() => {
      if (reducedMotion && page < pages.length - 1) setPage((p) => p + 1);
      else {
        complete.current();
        if (reducedMotion && page > 0) setPage(0);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [
    paused,
    reducedMotion,
    widths,
    overflow,
    duration,
    page,
    pages.length,
    body,
  ]);
  return (
    <div
      className="announcement-text"
      ref={container}
      aria-label={body}
      data-notice-page={reducedMotion ? page + 1 : 1}
      data-notice-pages={reducedMotion ? pages.length : 1}
    >
      <b
        className="announcement-measure"
        ref={measureText}
        data-measure-text={body}
        aria-hidden="true"
      />
      <span
        aria-hidden="true"
        className={!reducedMotion && overflow ? "announcement-scroll" : ""}
        style={
          {
            "--scroll-start": `${widths.container}px`,
            "--scroll-end": `-${widths.text}px`,
            "--scroll-duration": `${duration}s`,
            animationPlayState: paused ? "paused" : "running",
          } as React.CSSProperties
        }
      >
        {reducedMotion ? (pages[page] ?? "") : body}
      </span>
    </div>
  );
}
