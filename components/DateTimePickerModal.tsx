"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildUtcIsoString,
  formatUtcDateTimeLabel,
  getUtcDateInputValue,
  getUtcTimeInputValue,
} from "@/lib/recurringOrderService";

type DateTimePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (isoString: string) => void;
  currentValue?: string | null;
  title: string;
  description: string;
  minValue?: string | null;
  allowClear?: boolean;
  onClear?: () => void;
};

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

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const value = `${String(hours).padStart(2, "0")}:${minutes}`;
  const labelDate = new Date(Date.UTC(2026, 0, 1, hours, Number(minutes)));
  const label = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(labelDate);

  return { value, label, fullLabel: `${label} UTC` };
});

const parseUtcDateParts = (dateString?: string | null) => {
  const normalizedDate = getUtcDateInputValue(dateString);
  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return { year, month: month - 1, day };
};

export function DateTimePickerModal({
  isOpen,
  onClose,
  onSave,
  currentValue,
  title,
  description,
  minValue,
  allowClear = false,
  onClear,
}: DateTimePickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("00:00");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const utcParts = parseUtcDateParts(currentValue);
    const initialDate = utcParts
      ? new Date(utcParts.year, utcParts.month, utcParts.day)
      : new Date();

    setCurrentMonth(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    setSelectedDate(initialDate);
    setSelectedTime(getUtcTimeInputValue(currentValue) || "00:00");
    setValidationError(null);
  }, [currentValue, isOpen]);

  const minDateValue = useMemo(() => {
    const utcParts = parseUtcDateParts(minValue);
    return utcParts
      ? new Date(utcParts.year, utcParts.month, utcParts.day)
      : null;
  }, [minValue]);

  if (!isOpen) {
    return null;
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, index) => index);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const minLabel = minValue ? formatUtcDateTimeLabel(minValue, "") : "";

  const previousMonth = () => {
    const newMonth = new Date(year, month - 1, 1);
    const lowerBoundMonth = minDateValue
      ? new Date(minDateValue.getFullYear(), minDateValue.getMonth(), 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    if (newMonth >= lowerBoundMonth) {
      setCurrentMonth(newMonth);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
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
    const minimumDate = minDateValue ? new Date(minDateValue) : today;
    minimumDate.setHours(0, 0, 0, 0);
    const lowerBound = minimumDate > today ? minimumDate : today;
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < lowerBound;
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(year, month, day);
    setSelectedDate(selected);
    setValidationError(null);
  };

  const previewValue =
    selectedDate && selectedTime
      ? buildUtcIsoString(
          `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`,
          selectedTime,
        )
      : "";

  const handleSave = () => {
    if (!selectedDate) {
      setValidationError("Select a UTC date.");
      return;
    }

    const isoValue = buildUtcIsoString(
      `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`,
      selectedTime,
    );
    const nextDate = new Date(isoValue);

    if (Number.isNaN(nextDate.getTime())) {
      setValidationError("The selected UTC schedule is invalid.");
      return;
    }

    if (minValue && nextDate < new Date(minValue)) {
      setValidationError(`Choose a time on or after ${minLabel}.`);
      return;
    }

    onSave(isoValue);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="mx-auto my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900"
      >
        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-5 sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-gray-400">
                <Clock3 className="h-3.5 w-3.5" />
                <span>UTC Schedule</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-400">{description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 cursor-pointer"
            >
              <X className="h-4 w-4 text-white" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_170px]">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={previousMonth}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4 text-white" />
                  </Button>
                  <h3 className="min-w-45 text-center text-lg font-semibold text-white">
                    {monthNames[month]} {year}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextMonth}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4 text-white" />
                  </Button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-7 gap-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-gray-500"
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
                        ? "cursor-not-allowed text-gray-500"
                        : isSelectedDate(day)
                          ? "bg-white font-semibold text-black hover:bg-white/90"
                          : isToday(day)
                            ? "bg-zinc-800 font-medium text-white hover:bg-zinc-700"
                            : "text-gray-400 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-[#18191c] p-3.5">
              <div className="mb-4">
                <p className="text-sm font-medium text-white">Time</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Pick the exact UTC time for this execution window.
                </p>
              </div>

              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1 sm:max-h-56">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedTime(option.value);
                      setValidationError(null);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedTime === option.value
                        ? "bg-white font-semibold text-black"
                        : "text-gray-300 hover:bg-zinc-800 hover:text-white"
                    }`}
                  >
                    <span className="whitespace-nowrap tabular-nums sm:hidden">
                      {option.label}
                    </span>
                    <span className="whitespace-nowrap text-xs opacity-70 sm:hidden">
                      {option.value} UTC
                    </span>
                    <span className="hidden whitespace-nowrap tabular-nums sm:block">
                      {option.fullLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-[#18191c] px-4 py-3">
            <p className="text-xs font-medium text-gray-500">Selected execution time</p>
            <p className="mt-1 whitespace-nowrap text-sm font-medium text-white">
              {previewValue
                ? formatUtcDateTimeLabel(previewValue)
                : "Select a UTC date and time"}
            </p>
            {minLabel ? (
              <p className="mt-1 text-xs text-gray-500">Must be on or after {minLabel}</p>
            ) : null}
          </div>

          {validationError ? (
            <p className="mt-4 text-sm text-red-400">{validationError}</p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div>
              {allowClear && onClear ? (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-zinc-800 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-100"
              >
                Save UTC Time
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
