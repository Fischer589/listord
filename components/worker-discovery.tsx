"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { WorkerCard } from "./worker-card";
import { takeDiscoveryRequest } from "@/lib/contact-context";
import type { Worker } from "@/lib/types";
import type { RequestDraft } from "@/lib/request-specification";

interface WorkerDiscoveryProps {
  workers: Worker[];
  categoryLabel?: string;
}

export function WorkerDiscovery({ workers, categoryLabel }: WorkerDiscoveryProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
  useEffect(() => { setRequestDraft(takeDiscoveryRequest()); }, []);

  const updatePosition = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    setCanGoPrevious(carousel.scrollLeft > 2);
    setCanGoNext(carousel.scrollLeft < maxScroll - 2);
    const viewport = carousel.getBoundingClientRect();
    const slides = carousel.querySelectorAll<HTMLElement>(".discovery-slide");
    let bestIndex = 0;
    let bestVisible = 0;
    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left)) / rect.width;
      if (visible > bestVisible + 0.001) { bestVisible = visible; bestIndex = index; }
    });
    setActiveIndex(bestIndex);
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(carousel);
    updatePosition();
    return () => observer.disconnect();
  }, [updatePosition, workers.length]);

  const handleScroll = useCallback(() => {
    setHasScrolled(true);
    updatePosition();
  }, [updatePosition]);

  const move = useCallback((direction: -1 | 1) => {
    const carousel = carouselRef.current;
    const first = carousel?.querySelector<HTMLElement>(".discovery-slide");
    if (!carousel || !first) return;
    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap) || 0;
    carousel.scrollBy({ left: direction * (first.getBoundingClientRect().width + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
    carousel.scrollTo({ left: offset, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
            {workers.length === 1 ? "perfil revisado" : "perfiles revisados"}
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

      {/* ── Snap carousel and controls ── */}
      <div className="discovery-carousel-frame">
      <button type="button" className="discovery-arrow discovery-arrow--previous" aria-label="Perfil anterior" aria-controls="worker-discovery-carousel" disabled={!canGoPrevious} onClick={() => move(-1)}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div
        id="worker-discovery-carousel"
        ref={carouselRef}
        className="discovery-carousel"
        onScroll={handleScroll}
        role="region"
        tabIndex={0}
        aria-label={
          categoryLabel
            ? `Trabajadores de ${categoryLabel}`
            : "Perfiles de trabajadores revisados"
        }
      >
        {workers.map((worker, i) => (
          <div
            key={worker.id}
            className={`discovery-slide${
              i === activeIndex ? " discovery-slide--active" : ""
            }`}
          >
            <WorkerCard worker={worker} requestDraft={requestDraft} />
          </div>
        ))}
      </div>
      <button type="button" className="discovery-arrow discovery-arrow--next" aria-label="Perfil siguiente" aria-controls="worker-discovery-carousel" disabled={!canGoNext} onClick={() => move(1)}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
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
