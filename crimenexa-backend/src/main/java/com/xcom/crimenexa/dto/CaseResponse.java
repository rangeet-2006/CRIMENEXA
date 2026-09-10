package com.xcom.crimenexa.dto;

import java.time.LocalDate;

public class CaseResponse {

    private String id;
    private String caseCode;
    private String operationName;
    private String status;
    private String officerName;
    private int entitiesCount;
    private String priority;
    private LocalDate openedDate;

    public CaseResponse() {
    }

    public CaseResponse(String id, String caseCode, String operationName, String status, String officerName,
                         int entitiesCount, String priority, LocalDate openedDate) {
        this.id = id;
        this.caseCode = caseCode;
        this.operationName = operationName;
        this.status = status;
        this.officerName = officerName;
        this.entitiesCount = entitiesCount;
        this.priority = priority;
        this.openedDate = openedDate;
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

    public String getOperationName() {
        return operationName;
    }

    public void setOperationName(String operationName) {
        this.operationName = operationName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getOfficerName() {
        return officerName;
    }

    public void setOfficerName(String officerName) {
        this.officerName = officerName;
    }

    public int getEntitiesCount() {
        return entitiesCount;
    }

    public void setEntitiesCount(int entitiesCount) {
        this.entitiesCount = entitiesCount;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public LocalDate getOpenedDate() {
        return openedDate;
    }

    public void setOpenedDate(LocalDate openedDate) {
        this.openedDate = openedDate;
    }
}