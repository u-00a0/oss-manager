use sqlx::{SqlitePool, Row, FromRow};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Paused,
    Running,
    Completed,
    Failed,
}

impl ToString for TaskStatus {
    fn to_string(&self) -> String {
        match self {
            TaskStatus::Paused => "paused".to_string(),
            TaskStatus::Running => "running".to_string(),
            TaskStatus::Completed => "completed".to_string(),
            TaskStatus::Failed => "failed".to_string(),
        }
    }
}

impl From<String> for TaskStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "paused" => TaskStatus::Paused,
            "running" => TaskStatus::Running,
            "completed" => TaskStatus::Completed,
            "failed" => TaskStatus::Failed,
            _ => TaskStatus::Paused, // Default fallback
        }
    }
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub file_path: String,
    pub remote_key: String,
    pub bucket: String,
    pub total_size: i64,
    pub status: String, // Stored as string in DB
    pub upload_id: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Part {
    pub task_id: i64,
    pub part_number: i64,
    pub start_byte: i64,
    pub end_byte: i64,
    pub is_completed: bool,
    pub etag: Option<String>,
}

#[derive(Clone)]
pub struct TaskRepository {
    pool: SqlitePool,
}

impl TaskRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Run migrations
    pub async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn create_task(
        &self,
        file_path: &str,
        remote_key: &str,
        bucket: &str,
        total_size: i64,
    ) -> Result<i64> {
        let id = sqlx::query(
            r#"
            INSERT INTO tasks (file_path, remote_key, bucket, total_size, status)
            VALUES (?, ?, ?, ?, 'paused')
            RETURNING id
            "#,
        )
        .bind(file_path)
        .bind(remote_key)
        .bind(bucket)
        .bind(total_size)
        .fetch_one(&self.pool)
        .await?
        .get(0);

        Ok(id)
    }

    pub async fn find_active_task(&self, bucket: &str, remote_key: &str) -> Result<Option<Task>> {
        let task = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE bucket = ? AND remote_key = ? AND status != 'completed' AND status != 'failed' ORDER BY created_at DESC LIMIT 1"
        )
        .bind(bucket)
        .bind(remote_key)
        .fetch_optional(&self.pool)
        .await?;
        Ok(task)
    }

    pub async fn set_upload_id(&self, task_id: i64, upload_id: &str) -> Result<()> {
        sqlx::query(
            "UPDATE tasks SET upload_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(upload_id)
        .bind(task_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_task(&self, id: i64) -> Result<Option<Task>> {
        let task = sqlx::query_as::<_, Task>(
            "SELECT * FROM tasks WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(task)
    }

    pub async fn update_task_status(&self, id: i64, status: TaskStatus) -> Result<()> {
        sqlx::query(
            "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(status.to_string())
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn create_parts(&self, parts: Vec<Part>) -> Result<()> {
        // Bulk insert parts
        // Note: SQLite has a limit on variables, for very large files batching might be needed.
        // For simplicity, we assume reasonable batch size or loop.
        // Using a transaction is recommended.
        let mut tx = self.pool.begin().await?;

        for part in parts {
            sqlx::query(
                r#"
                INSERT INTO parts (task_id, part_number, start_byte, end_byte, is_completed, etag)
                VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(part.task_id)
            .bind(part.part_number)
            .bind(part.start_byte)
            .bind(part.end_byte)
            .bind(part.is_completed)
            .bind(part.etag)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn mark_part_completed(&self, task_id: i64, part_number: i64, etag: Option<String>) -> Result<()> {
        sqlx::query(
            "UPDATE parts SET is_completed = 1, etag = ? WHERE task_id = ? AND part_number = ?"
        )
        .bind(etag)
        .bind(task_id)
        .bind(part_number)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_incomplete_parts(&self, task_id: i64) -> Result<Vec<Part>> {
        let parts = sqlx::query_as::<_, Part>(
            "SELECT * FROM parts WHERE task_id = ? AND is_completed = 0 ORDER BY part_number ASC"
        )
        .bind(task_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(parts)
    }

    pub async fn get_completed_parts(&self, task_id: i64) -> Result<Vec<Part>> {
        let parts = sqlx::query_as::<_, Part>(
            "SELECT * FROM parts WHERE task_id = ? AND is_completed = 1 ORDER BY part_number ASC"
        )
        .bind(task_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(parts)
    }
    
    pub async fn get_task_progress(&self, task_id: i64) -> Result<(i64, i64)> {
         let row: (i64, i64) = sqlx::query_as(
            "SELECT COUNT(*), SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) FROM parts WHERE task_id = ?"
        )
        .bind(task_id)
        .fetch_one(&self.pool)
        .await?;
        
        Ok(row)
    }
}
