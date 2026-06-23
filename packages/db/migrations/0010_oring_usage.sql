-- O-ring rework: a model uses several sizes; record the AMOUNT per size as JSON.
-- Basics (3/8", 1/2", 5/8") plus special sizes, e.g. [{"size":"3/8\"","qty":3},{"size":"1/2\"","qty":2}].
-- Additive only. Supersedes the single `oring_size` column, which is intentionally LEFT IN PLACE
-- (unused) so the previously-deployed Worker keeps working during the rollout window.
ALTER TABLE `car_models` ADD COLUMN `oring_usage` text;
