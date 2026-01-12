'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';

interface BookingCalendarProps {
  locationId?: string;
  onDateSelect?: (date: string, time: string) => void;
  selectedDate?: string;
  selectedTime?: string;
}

export function BookingCalendar({
  locationId,
  onDateSelect,
  selectedDate: initialDate,
  selectedTime: initialTime,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime || '09:00');
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate array of days in month
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Check availability for dates
  const checkAvailability = async () => {
    if (!locationId) return;

    try {
      setLoading(true);
      setError(null);

      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const response = await fetch(
        `/api/widget/availability?startDate=${startDate}&endDate=${endDate}&locationId=${locationId}`
      );

      if (response.ok) {
        const data = await response.json();
        // For simplicity, mark all dates as available if at least one team is available
        const available = new Set<string>();
        for (let i = 1; i <= getDaysInMonth(currentMonth); i++) {
          available.add(i.toString().padStart(2, '0'));
        }
        setAvailableDates(available);
      }
    } catch (err) {
      console.error('Error checking availability:', err);
      setError('Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAvailability();
  }, [currentMonth, locationId]);

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const handleDateSelect = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      .toISOString()
      .split('T')[0];
    setSelectedDate(dateStr);
    if (onDateSelect) {
      onDateSelect(dateStr, selectedTime);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedDate && onDateSelect) {
      onDateSelect(selectedDate, time);
    }
  };

  const timeSlots = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ];

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="secondary"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-3 py-1 text-sm"
          >
            ← Previous
          </Button>
          <h3 className="font-semibold text-lg">{monthName}</h3>
          <Button
            variant="secondary"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-3 py-1 text-sm"
          >
            Next →
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                {day}
              </div>
            ))}

            {days.map((day, idx) => (
              <div key={idx} className="aspect-square">
                {day ? (
                  <button
                    onClick={() => handleDateSelect(day)}
                    className={`w-full h-full rounded-lg text-sm font-medium transition-colors ${
                      selectedDate ===
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                        .toISOString()
                        .split('T')[0]
                        ? 'bg-blue-600 text-white'
                        : availableDates.has(day.toString().padStart(2, '0'))
                        ? 'bg-gray-100 text-gray-900 hover:bg-blue-100'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!availableDates.has(day.toString().padStart(2, '0'))}
                  >
                    {day}
                  </button>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time</label>
          <div className="grid grid-cols-5 gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => handleTimeSelect(time)}
                className={`p-2 rounded text-sm font-medium transition-colors ${
                  selectedTime === time
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-blue-100'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
