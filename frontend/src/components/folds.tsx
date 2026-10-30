// Lets Android's back button close open foldable sections before leaving the page.
// Each page (Screen) keeps a list of its open sections. Back closes the deepest one first
// (and, among equally deep ones, the one opened last). Only when none are open does back
// leave the page.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { BackHandler } from "react-native";

type OpenFold = { id: number; depth: number; openedAt: number; close: () => void };

type Registry = {
  opened: (fold: OpenFold) => void;
  closed: (id: number) => void;
};

const RegistryContext = createContext<Registry | null>(null);
// How deep a foldable is: 0 at the top, 1 inside another foldable, and so on.
const DepthContext = createContext(0);

let nextId = 0;
export const newFoldId = () => nextId++;

/** Wraps a page. While the page is on screen, back closes its open sections first. */
export function FoldRegistry({ children }: { children: React.ReactNode }) {
  const open = useRef<OpenFold[]>([]);

  const registry = useMemo<Registry>(
    () => ({
      opened: (fold) => {
        open.current = [...open.current.filter((f) => f.id !== fold.id), fold];
      },
      closed: (id) => {
        open.current = open.current.filter((f) => f.id !== id);
      },
    }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        const [first, ...rest] = open.current;
        if (!first) return false; // nothing open: let back leave the page
        const target = rest.reduce(
          (best, fold) =>
            fold.depth > best.depth || (fold.depth === best.depth && fold.openedAt > best.openedAt)
              ? fold
              : best,
          first,
        );
        target.close();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  return <RegistryContext value={registry}>{children}</RegistryContext>;
}

export function useFoldRegistry() {
  return useContext(RegistryContext);
}

export function useFoldDepth() {
  return useContext(DepthContext);
}

/** Marks everything inside as one level deeper. */
export function Deeper({ depth, children }: { depth: number; children: React.ReactNode }) {
  return <DepthContext value={depth + 1}>{children}</DepthContext>;
}
