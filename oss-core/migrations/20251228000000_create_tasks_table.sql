-- Add migration script here
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    remote_key TEXT NOT NULL,
    bucket TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('paused', 'running', 'completed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parts (
    task_id INTEGER NOT NULL,
    part_number INTEGER NOT NULL,
    start_byte INTEGER NOT NULL,
    end_byte INTEGER NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    etag TEXT,
    PRIMARY KEY (task_id, part_number),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
