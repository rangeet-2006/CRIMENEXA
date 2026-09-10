package com.xcom.crimenexa.dto;

import java.time.Instant;

/**
 * Evidence record as returned to the client.
 *
 * Deliberately omits filePath: the storage location is an internal detail and
 * echoing it back to the browser leaks server layout for no benefit. fileHash
 * IS included - it is the integrity value an investigator may need to cite.
 */
public class EvidenceResponse {

    private String id;
    private String caseId;
    private String fileName;
    private String documentCategory;
    private String fileHash;
    private String status;
    private Instant uploadedAt;
    /** Null unless status is FAILED. */
    private String processingError;

    public EvidenceResponse() {
    }

    public EvidenceResponse(String id, String caseId, String fileName, String documentCategory,
                             String fileHash, String status, Instant uploadedAt, String processingError) {
        this.id = id;
        this.caseId = caseId;
        this.fileName = fileName;
        this.documentCategory = documentCategory;
        this.fileHash = fileHash;
        this.status = status;
        this.uploadedAt = uploadedAt;
        this.processingError = processingError;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getDocumentCategory() {
        return documentCategory;
    }

    public void setDocumentCategory(String documentCategory) {
        this.documentCategory = documentCategory;
    }

    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(Instant uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public String getProcessingError() {
        return processingError;
    }

    public void setProcessingError(String processingError) {
        this.processingError = processingError;
    }
}
