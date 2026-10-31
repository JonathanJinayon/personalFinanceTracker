"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { TigomMascot } from "@/components/assistant/tigom-mascot";

type Position = { x: number; y: number };
type DragSession = { pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean };

const launcherSize = 112;
const edgeMargin = 16;
const sessionPositionKey = "tigom-assistant-position";

function getInitialPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(sessionPositionKey);
    if (saved) return JSON.parse(saved) as Position;
  } catch {
    return null;
  }
  return null;
}

function clampPosition(position: Position, size: number): Position {
  const safeAreaRight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-right")) || 0;
  const safeAreaBottom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-bottom")) || 0;
  return {
    x: Math.min(Math.max(edgeMargin, position.x), Math.max(edgeMargin, window.innerWidth - size - edgeMargin - safeAreaRight)),
    y: Math.min(Math.max(edgeMargin, position.y), Math.max(edgeMargin, window.innerHeight - size - edgeMargin - safeAreaBottom)),
  };
}

export function AssistantLauncher() {
  const [position, setPosition] = useState<Position | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const mascotRef = useRef<SVGSVGElement>(null);

  const clampToLauncher = useCallback((next: Position) => {
    const rect = mascotRef.current?.getBoundingClientRect();
    return clampPosition(next, Math.max(rect?.width ?? launcherSize, rect?.height ?? launcherSize));
  }, []);

  useEffect(() => {
    const savedPosition = getInitialPosition();
    if (savedPosition) {
      window.requestAnimationFrame(() => setPosition(clampToLauncher(savedPosition)));
    }
    function resize() {
        setPosition((current) => current ? clampToLauncher(current) : current);
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [clampToLauncher]);

  useEffect(() => {
    if (!position) return;
    try {
      window.sessionStorage.setItem(sessionPositionKey, JSON.stringify(position));
    } catch {
      return;
    }
  }, [position]);

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = position ?? clampToLauncher({ x: rect.left, y: rect.top });
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 6) return;
    drag.moved = true;
    setIsDragging(true);
    setPosition(clampToLauncher({ x: drag.originX + deltaX, y: drag.originY + deltaY }));
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    if (drag.moved) {
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setIsReacting(true);
    window.setTimeout(() => setIsReacting(false), 500);
    mascotRef.current?.querySelector(".tigom-mascot-wave-arm")?.classList.remove("tigom-mascot-wave-arm");
    const wavingArm = mascotRef.current?.querySelector("[data-mascot-wave-arm]");
    if (wavingArm) {
      void wavingArm.getBoundingClientRect();
      wavingArm.classList.add("tigom-mascot-wave-arm");
    }
    setIsOpen((current) => !current);
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") setIsOpen(false);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const current = position ?? clampToLauncher({
        x: window.innerWidth - launcherSize - edgeMargin,
        y: window.innerHeight - launcherSize - edgeMargin,
      });
      const step = event.shiftKey ? 48 : 16;
      const next = {
        x: current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
        y: current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
      };
      setPosition(clampToLauncher(next));
    }
  }

  return (
    <>
      {isOpen && position ? <AssistantPanel launcherPosition={position} onClose={() => setIsOpen(false)} /> : null}
      <TigomMascot
        ref={mascotRef}
        title={isOpen ? "Close TIGOM Assistant" : "Open TIGOM Assistant"}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={position ? { left: position.x, top: position.y, touchAction: "none" } : { right: edgeMargin, bottom: edgeMargin, touchAction: "none" }}
        className={`fixed z-[61] !h-[min(32vw,112px)] !w-[min(29vw,100px)] !min-h-[76px] !min-w-[68px] select-none overflow-visible bg-transparent p-0 drop-shadow-[0_4px_6px_rgba(6,78,59,0.1)] outline-none transition-transform duration-200 hover:scale-[1.035] focus-visible:drop-shadow-[0_0_5px_var(--ring)] sm:!h-[116px] sm:!w-[102px] sm:!min-h-0 sm:!min-w-0 lg:!h-[128px] lg:!w-[112px] ${!isDragging && !isOpen ? "tigom-mascot-idle" : ""} ${isReacting ? "tigom-mascot-react" : ""} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      />
    </>
  );
}
