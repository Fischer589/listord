"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { WorkerCard } from "./worker-card";
import type { Worker } from "@/lib/types";

interface WorkerDiscoveryProps {
  workers: Worker[];
  categoryLabel?: string;
}

export function WorkerDiscovery({ workers, categoryLabel }: WorkerDiscoveryProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Track which slide is most visible via IntersectionObserver
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || workers.length === 0) return;

    const slides = Array.from(
      carousel.querySelectorAll<HTMLElement>(".discovery-slide")
    );

    const obs = new IntersectionObserver(
      (entries) => {
        let best = -1;
        let bestRatio = 0;
        entries.forEach((entry) => {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            best = slides.indexOf(entry.target as HTMLElement);
          }
        });
        if (best !== -1 && bestRatio > 0.4) {
          setActiveIndex(best);
        }
      },
      { root: carousel, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    slides.forEach((slide) => obs.observe(slide));
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers.length]);

  const handleScroll = useCallback(() => {
    setHasScrolled(true);
  }, []);

  // Scroll carousel to a specific index using getBoundingClientRect for accuracy
  const scrollToIndex = useCallback((idx: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const slides = carousel.querySelectorAll<HTMLElement>(".discovery-slide");
    const target = slides[idx];
    if (!target) return;
    const carouselRect = carousel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.left - carouselRect.left + carousel.scrollLeft;
    carousel.scrollTo({ left: offset, behavior: "smooth" });
  }, []);

  if (workers.length === 0) return null;

  const progress = ((activeIndex + 1) / workers.length) * 100;

  return (
    <div className="discovery-shell">

      {/* ── Live header: count pill + position counter ── */}
      <div className="discovery-header">
        <div className="discovery-live-pill">
          <span className="discovery-live-dot" aria-hidden="true" />
          <span>
            {workers.length}{" "}
            {workers.length === 1 ? "disponible" : "disponibles"} ahora
          </span>
        </div>
        <span
          className="discovery-counter"
          aria-live="polite"
          aria-label={`Perfil ${activeIndex + 1} de ${workers.length}`}
        >
          {activeIndex + 1}
          <span className="discovery-counter-sep"> / </span>
          {workers.length}
        </span>
      </div>

      {/* ── Snap carousel ── */}
      <div
        ref={carouselRef}
        className="discovery-carousel"
        onScroll={handleScroll}
        role="region"
        aria-label={
          categoryLabel
            ? `Trabajadores de ${categoryLabel}`
            : "Trabajadores disponibles"
        }
      >
        {workers.map((worker, i) => (
          <div
            key={worker.id}
            className={`discovery-slide${
              i === activeIndex ? " discovery-slide--active" : ""
            }`}
          >
            <WorkerCard worker={worker} />
          </div>
        ))}
      </div>

      {/* ── Progress rail ── */}
      <div className="discovery-progress-rail" aria-hidden="true">
        <div
          className="discovery-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Navigation dots (≤ 12 workers) ── */}
      {workers.length > 1 && workers.length <= 12 && (
        <div className="discovery-dots" aria-hidden="true">
          {workers.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`discovery-dot${
                i === activeIndex ? " discovery-dot--active" : ""
              }`}
              onClick={() => scrollToIndex(i)}
              tabIndex={-1}
            />
          ))}
        </div>
      )}

      {/* ── Swipe hint — fades out after first scroll ── */}
      {!hasScrolled && workers.length > 1 && (
        <p className="discovery-hint" aria-hidden="true">
          ← Desliza para descubrir →
        </p>
      )}

    </div>
  );
}
