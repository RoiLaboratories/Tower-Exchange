-- Treat the date selected in the recurring order form as the first execution
-- date. Older builds saved that date into end_date while next_execution_date
-- was computed only from frequency, so orders did not run on the chosen date.

UPDATE recurring_orders
SET
  next_execution_date = end_date,
  end_date = NULL,
  updated_at = now()
WHERE
  is_active = true
  AND COALESCE(execution_count, 0) = 0
  AND end_date IS NOT NULL
  AND (
    next_execution_date IS NULL
    OR next_execution_date > end_date
  );

