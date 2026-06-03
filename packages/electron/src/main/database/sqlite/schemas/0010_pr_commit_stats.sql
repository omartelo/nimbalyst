-- ----------------------------------------------------------------------------
-- 0010_pr_commit_stats
--
-- Per-commit additions/deletions for the PR review Commits tab (issue #307).
-- The PR commits list endpoint omits stats, so these are filled from the
-- single-commit endpoint and cached here. Additive, nullable-with-default so
-- existing rows are unaffected.
-- ----------------------------------------------------------------------------

ALTER TABLE pull_request_commits ADD COLUMN additions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pull_request_commits ADD COLUMN deletions INTEGER NOT NULL DEFAULT 0;
