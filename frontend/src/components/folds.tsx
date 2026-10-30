// Lets Android's back button close open foldable sections before leaving the page.
// Each page (Screen) keeps a list of its open sections. The first back closes the deepest one
// (among equally deep ones, the one opened last). Each following back closes the section that
// one was inside, then the one around that, and so on up, which also folds anything else open
// inside them. Opening a section starts over from the deepest. When nothing is open, back
// leaves the page.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { BackHandler } from "react-native";

type OpenFold = {
  id: number;
  /** The section this one is inside, or null at the top. */
  parentId: number | null;
  depth: number;
  openedAt: number;
  close: () => void;
};

type Registry = {
  opened: (fold: OpenFold) => void;
  closed: (id: number) => void;
};

/** Where a foldable sits: how deep (0 at the top), and which section it's inside. */
type Place = { depth: number; parentId: number | null };

const RegistryContext = createContext<Registry | null>(null);
const PlaceContext = createContext<Place>({ depth: 0, parentId: null });

let nextId = 0;
export const newFoldId = () => nextId++;

function deepestLatest(folds: OpenFold[]): OpenFold | undefined {
  return folds.reduce<OpenFold | undefined>(
    (best, fold) =>
      !best ||
      fold.depth > best.depth ||
      (fold.depth === best.depth && fold.openedAt > best.openedAt)
        ? fold
        : best,
    undefined,
  );
}

/** Wraps a page. While the page is on screen, back closes its open sections first. */
export function FoldRegistry({ children }: { children: React.ReactNode }) {
  const open = useRef<OpenFold[]>([]);
  // The section the next back should close, after a back already closed one inside it.
  const next = useRef<number | null>(null);

  const registry = useMemo<Registry>(
    () => ({
      opened: (fold) => {
        open.current = [...open.current.filter((f) => f.id !== fold.id), fold];
        next.current = null; // opening something starts over from the deepest
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
        const target =
          open.current.find((fold) => fold.id === next.current) ?? deepestLatest(open.current);
        if (!target) return false; // nothing open: let back leave the page
        target.close();
        next.current = target.parentId;
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

export function useFoldPlace() {
  return useContext(PlaceContext);
}

/** Marks everything inside as one level deeper, inside the section `parentId`. */
export function Inside({
  place,
  parentId,
  children,
}: {
  place: Place;
  parentId: number;
  children: React.ReactNode;
}) {
  return <PlaceContext value={{ depth: place.depth + 1, parentId }}>{children}</PlaceContext>;
}
