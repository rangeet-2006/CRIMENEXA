package com.xcom.crimenexa.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "evidence")
public class Evidence {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_category", nullable = false)
    private DocumentCategory documentCategory;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "file_hash", nullable = false)
    private String fileHash;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UploadStatus status;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt = Instant.now();

    /**
     * Why asynchronous processing failed, when it did.
     *
     * Nullable and only set alongside status FAILED. Exists because the upload
     * response returns before the AI call runs, so a failure afterwards had no
     * route back to the user - it lived in the server log alone.
     *
     * Adding a nullable column is safe under ddl-auto=update, unlike changing a
     * CHECK constraint (see db/migrations/001).
     */
    @Column(name = "processing_error", length = 512)
    private String processingError;

    /**
     * Object-storage key for the file in Supabase, null if that upload failed.
     *
     * filePath still records the local copy, but local disk here is ephemeral -
     * this is the location that actually survives a container recycle.
     */
    @Column(name = "storage_path")
    private String storagePath;

    public enum DocumentCategory {
        // LOCATION routes to the AI service's /ingestion/location endpoint,
        // which accepts GPS point CSV/JSON. Added so location evidence can be
        // uploaded through the backend rather than only direct to the AI service.
        FIR, CALL_RECORDS, BANK_RECORDS, LOCATION, SOCIAL_MEDIA, SURVEILLANCE, FORENSIC, OTHER
    }

    public enum UploadStatus {
        QUEUED, PROCESSING, EXTRACTED, FAILED
    }

    public Evidence() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCaseId() {
        return caseId;
    }

    public void setCaseId(UUID caseId) {
        this.caseId = caseId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public DocumentCategory getDocumentCategory() {
        return documentCategory;
    }

    public void setDocumentCategory(DocumentCategory documentCategory) {
        this.documentCategory = documentCategory;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    public UUID getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(UUID uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public UploadStatus getStatus() {
        return status;
    }

    public void setStatus(UploadStatus status) {
        this.status = status;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public void setStoragePath(String storagePath) {
        this.storagePath = storagePath;
    }

    public String getProcessingError() {
        return processingError;
    }

    public void setProcessingError(String processingError) {
        this.processingError = processingError;
    }

    public void setUploadedAt(Instant uploadedAt) {
        this.uploadedAt = uploadedAt;
    }
}