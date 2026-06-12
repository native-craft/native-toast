import { useEffect, useState } from "react";
import { addListener, memoryState } from "./store";
import type { ToasterState } from "./types";

export function useToasterStore(): ToasterState {
  const [state, setState] = useState<ToasterState>(memoryState);

  useEffect(() => {
    setState(memoryState);
    return addListener(setState);
  }, []);

  return state;
}
