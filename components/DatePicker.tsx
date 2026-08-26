"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  currentValue: string;
  minDate?: string;
}

export const DatePicker = ({
  isOpen,
  onClose,
  onSelect,
  currentValue,
  minDate,
}: DatePickerProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(
    currentValue ? new Date(currentValue) : new Date()
  );

  if (!isOpen) return null;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const previousMonth = () => {
    const newMonth = new Date(year, month - 1, 1);
    const today = new Date();
    // Don't allow going to months before current month
    if (newMonth.getFullYear() > today.getFullYear() || 
        (newMonth.getFullYear() === today.getFullYear() && newMonth.getMonth() >= today.getMonth())) {
      setCurrentMonth(newMonth);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(year, month, day);
    setSelectedDate(selected);
    const formattedDate = `${String(month + 1).padStart(2, "0")}/${String(
      day
    ).padStart(2, "0")}/${year}`;
    onSelect(formattedDate);
    onClose();
  };

  const isSelectedDate = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isUnavailableDate = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minimumDate = minDate ? new Date(minDate) : today;
    minimumDate.setHours(0, 0, 0, 0);
    const lowerBound = minimumDate > today ? minimumDate : today;
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < lowerBound;
  };

  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl w-full max-w-sm border border-border"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={previousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </Button>
              <h3 className="text-lg font-semibold text-foreground min-w-45 text-center">
                {monthNames[month]} {year}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 cursor-pointer"
            >
              <X className="h-4 w-4 text-foreground" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div
                key={day}
                className="text-center text-muted-foreground text-sm font-medium"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}
            {days.map((day) => (
              <Button
                key={day}
                variant={isSelectedDate(day) ? "default" : "ghost"}
                size="icon"
                onClick={() => handleDateSelect(day)}
                disabled={isUnavailableDate(day)}
                className={`aspect-square h-auto text-sm ${
                  isUnavailableDate(day)
                    ? "text-muted-foreground cursor-not-allowed"
                    : isSelectedDate(day)
                    ? "bg-primary text-[#0C0C0D] hover:bg-primary/90 font-semibold"
                    : isToday(day)
                    ? "bg-accent text-foreground hover:bg-muted font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {day}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
