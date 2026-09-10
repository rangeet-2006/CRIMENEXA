package com.xcom.crimenexa.dto;

import java.time.Instant;

public class ReportResponse {

    private String id;
    private String title;
    private String caseCode;
    private String type;
    private int pages;
    private Instant generatedAt;
    private String downloadUrl;

    public ReportResponse() {
    }

    public ReportResponse(String id, String title, String caseCode, String type, int pages,
                           Instant generatedAt, String downloadUrl) {
        this.id = id;
        this.title = title;
        this.caseCode = caseCode;
        this.type = type;
        this.pages = pages;
        this.generatedAt = generatedAt;
        this.downloadUrl = downloadUrl;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCaseCode() {
        return caseCode;
    }

    public void setCaseCode(String caseCode) {
        this.caseCode = caseCode;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public int getPages() {
        return pages;
    }

    public void setPages(int pages) {
        this.pages = pages;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant generatedAt) {
        this.generatedAt = generatedAt;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }
}