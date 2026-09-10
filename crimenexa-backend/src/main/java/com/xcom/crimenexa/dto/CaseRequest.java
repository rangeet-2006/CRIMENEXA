package com.xcom.crimenexa.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class CaseRequest {

    @NotBlank
    private String operationName;

    @NotBlank
    private String priority;

    private LocalDate openedDate;

    public CaseRequest() {
    }

    public String getOperationName() {
        return operationName;
    }

    public void setOperationName(String operationName) {
        this.operationName = operationName;
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