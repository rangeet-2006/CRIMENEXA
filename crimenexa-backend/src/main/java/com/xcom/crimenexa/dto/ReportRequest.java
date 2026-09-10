package com.xcom.crimenexa.dto;

import jakarta.validation.constraints.NotBlank;

public class ReportRequest {

    @NotBlank
    private String caseId;

    @NotBlank
    private String reportType;

    public ReportRequest() {
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getReportType() {
        return reportType;
    }

    public void setReportType(String reportType) {
        this.reportType = reportType;
    }
}