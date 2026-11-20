import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { fakeFetch, resetFakeApi } from "./fake-api";

// Every hook talks to the Django API through fetch; tests get the in-memory fake.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetFakeApi();
  vi.unstubAllGlobals();
});
