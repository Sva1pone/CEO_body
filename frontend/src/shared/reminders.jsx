import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api } from "./api";

const RemindersContext = createContext({
  reminders: null,
  refreshReminders: async () => {},
});

export function RemindersProvider({ children }) {
  const [reminders, setReminders] = useState(null);

  const refreshReminders = useCallback(async () => {
    try {
      const payload = await api("/api/reminders");
      setReminders(payload);
      return payload;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    refreshReminders();
  }, [refreshReminders]);

  return (
    <RemindersContext.Provider value={{ reminders, refreshReminders }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  return useContext(RemindersContext);
}
