package com.xcom.crimenexa.dto;

import java.time.Instant;

public class AlertResponse {

    private String id;
    private String caseCode;
    private String severity;
    private String category;
    private String title;
    private String description;
    private boolean acknowledged;
    private Instant createdAt;

    public AlertResponse() {
    }

    public AlertResponse(String id, String caseCode, String severity, String category, String title,
                          String description, boolean acknowledged, Instant createdAt) {
        this.id = id;
        this.caseCode = caseCode;
        this.severity = severity;
        this.category = category;
        this.title = title;
        this.description = description;
        this.acknowledged = acknowledged;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCaseCode() {
        return caseCode;
    }

    public void setCaseCode(String caseCode) {
        this.caseCode = caseCode;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isAcknowledged() {
        return acknowledged;
    }

    public void setAcknowledged(boolean acknowledged) {
        this.acknowledged = acknowledged;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}