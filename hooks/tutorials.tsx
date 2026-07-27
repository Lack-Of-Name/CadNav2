import { TUTORIALS_COMPLETED } from '@/constants/storageKeys';
import { tutorialMap, type Tutorial } from '@/constants/tutorials';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type TutorialContextValue = {
  activeTutorial: Tutorial | null;
  showTutorial: (id: string) => void;
  closeTutorial: () => void;
  markCompleted: (id: string) => Promise<void>;
  hasCompleted: (id: string) => boolean;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TUTORIALS_COMPLETED);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        setCompletedSet(new Set(ids));
        loadedRef.current = true;

        // Auto-show tutorials with autoShow flag that haven't been completed
        for (const [id, tutorial] of tutorialMap) {
          if (tutorial.autoShow && !ids.includes(id)) {
            setActiveTutorial(tutorial);
            break;
          }
        }
      } catch {
        setCompletedSet(new Set());
        loadedRef.current = true;
      }
    })();
  }, []);

  const markCompleted = useCallback(async (id: string) => {
    setCompletedSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const raw = await AsyncStorage.getItem(TUTORIALS_COMPLETED);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        await AsyncStorage.setItem(TUTORIALS_COMPLETED, JSON.stringify(ids));
      }
    } catch {
      // Silently fail
    }
  }, []);

  const hasCompleted = useCallback(
    (id: string) => completedSet.has(id),
    [completedSet],
  );

  const showTutorial = useCallback(
    (id: string) => {
      const tutorial = tutorialMap.get(id);
      if (tutorial) {
        setActiveTutorial(tutorial);
      }
    },
    [],
  );

  const closeTutorial = useCallback(() => {
    setActiveTutorial(null);
  }, []);

  return (
    <TutorialContext.Provider
      value={{ activeTutorial, showTutorial, closeTutorial, markCompleted, hasCompleted }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorials(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorials must be used within a TutorialProvider');
  }
  return ctx;
}
