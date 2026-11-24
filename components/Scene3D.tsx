"use client";

import { useEffect, useRef, useState } from "react";
import { CafeScene, webglAvailable, type SceneView } from "@/lib/scene/CafeScene";
import { Fallback2D } from "./Fallback2D";

function forcedOff() {
  try {
    return new URLSearchParams(window.location.search).has("nowebgl");
  } catch {
    return false;
  }
}

/** The 3D café. Falls back to an illustrated 2D counter if WebGL is missing. */
export function Scene3D({ view }: { view: SceneView }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CafeScene | null>(null);
  const latest = useRef(view);
  const [failed, setFailed] = useState(() => forcedOff() || !webglAvailable());

  useEffect(() => {
    latest.current = view;
    scene.current?.setView(view);
  }, [view]);

  useEffect(() => {
    if (failed || !host.current) return;
    let s: CafeScene | null = null;
    try {
      s = new CafeScene(host.current);
      s.setView(latest.current);
      scene.current = s;
    } catch (err) {
      console.warn("WebGL unavailable, using 2D café", err);
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      s?.dispose();
      scene.current = null;
    };
  }, [failed]);

  if (failed) return <Fallback2D view={view} />;
  return <div ref={host} className="absolute inset-0" data-testid="scene-3d" />;
}
