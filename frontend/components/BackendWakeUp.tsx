"use client";

import { useEffect } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export function BackendWakeUp() {
  useEffect(() => {
    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(),
      15000
    );

    fetch(`${API_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    })
      .catch(() => {
        // Warm-up silenzioso: non deve bloccare il frontend.
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return null;
}
