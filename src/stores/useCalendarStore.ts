import { create } from 'zustand';

interface CalendarStore {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
  selectedDate: new Date(),
  setSelectedDate: (date: Date) => {
    // Only allow selecting today or past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If the date is in the future, don't update
    if (date > today) {
      return;
    }
    
    set({ selectedDate: date });
  },
})); 