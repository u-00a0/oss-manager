use oss_core::config::{ConfigManager, Profile};
use oss_core::db::{TaskRepository, TaskStatus, Part};
use oss_core::S3Provider;
use sqlx::sqlite::SqlitePoolOptions;
use std::path::Path;
use tokio;

#[tokio::test]
async fn test_config_manager() {
    let temp_dir = std::env::temp_dir().join("oss-core-test-config");
    tokio::fs::create_dir_all(&temp_dir).await.unwrap();
    let config_path = temp_dir.join("test_config.json");

    let mut manager = ConfigManager::new();
    let profile = Profile {
        provider: S3Provider::Aws,
        access_key: "test_ak".into(),
        secret_key: "test_sk".into(),
        region: "us-west-1".into(),
        endpoint: None,
        default_bucket: Some("my-bucket".into()),
    };

    manager.add_profile("test".into(), profile.clone());
    manager.save_to_file(&config_path).unwrap();

    let loaded = ConfigManager::load_from_file(&config_path).unwrap();
    let loaded_profile = loaded.get_profile("test").unwrap();

    assert_eq!(loaded_profile.access_key, "test_ak");
    assert_eq!(loaded_profile.region, "us-west-1");
    
    // Cleanup
    tokio::fs::remove_dir_all(&temp_dir).await.unwrap();
}

#[tokio::test]
async fn test_task_repository() {
    // Setup in-memory SQLite
    let pool = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .unwrap();
    
    let repo = TaskRepository::new(pool);
    repo.migrate().await.unwrap();

    // 1. Create Task
    let task_id = repo.create_task("/tmp/file.txt", "remote/key", "bucket", 1024).await.unwrap();
    let task = repo.get_task(task_id).await.unwrap().unwrap();
    
    assert_eq!(task.status, "paused");
    assert_eq!(task.total_size, 1024);

    // 2. Create Parts
    let parts = vec![
        Part { task_id, part_number: 1, start_byte: 0, end_byte: 512, is_completed: false, etag: None },
        Part { task_id, part_number: 2, start_byte: 512, end_byte: 1024, is_completed: false, etag: None },
    ];
    repo.create_parts(parts).await.unwrap();

    // 3. Check Progress (should be 0/2)
    let incomplete = repo.get_incomplete_parts(task_id).await.unwrap();
    assert_eq!(incomplete.len(), 2);
    let (total, completed) = repo.get_task_progress(task_id).await.unwrap();
    assert_eq!(total, 2);
    assert_eq!(completed, 0);

    // 4. Update Status and Complete Part
    repo.update_task_status(task_id, TaskStatus::Running).await.unwrap();
    repo.mark_part_completed(task_id, 1, Some("etag123".into())).await.unwrap();

    let incomplete_after = repo.get_incomplete_parts(task_id).await.unwrap();
    assert_eq!(incomplete_after.len(), 1);
    assert_eq!(incomplete_after[0].part_number, 2);

    let (total_new, completed_new) = repo.get_task_progress(task_id).await.unwrap();
    assert_eq!(total_new, 2);
    assert_eq!(completed_new, 1);

    // 5. Test Resumability (find active task)
    let found_task = repo.find_active_task("bucket", "remote/key").await.unwrap();
    assert!(found_task.is_some());
    assert_eq!(found_task.unwrap().id, task_id);
    
    // 6. Complete Task
    repo.update_task_status(task_id, TaskStatus::Completed).await.unwrap();
    let found_completed = repo.find_active_task("bucket", "remote/key").await.unwrap();
    assert!(found_completed.is_none()); // Should not find completed task as "active"
}
