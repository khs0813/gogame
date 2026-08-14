/// <reference lib="webworker" />

import { chooseAiMove } from "./ai";
import type { AiRequest, AiResponse } from "./types";

self.onmessage = (event: MessageEvent<AiRequest>) => {
  const { id, state, difficulty, seed } = event.data;
  const move = chooseAiMove(state, difficulty, seed);
  const response: AiResponse = { id, ...move };
  self.postMessage(response);
};

export {};
