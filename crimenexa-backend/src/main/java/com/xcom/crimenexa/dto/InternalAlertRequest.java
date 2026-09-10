package com.xcom.crimenexa.dto;

import jakarta.validation.constraints.NotBlank;

public class InternalAlertRequest {

    @NotBlank
    private String caseId;

    @NotBlank
    private String severity;

    @NotBlank
    private String category;

    @NotBlank
    private String title;

    private String description;

    public InternalAlertRequest() {
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
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
}