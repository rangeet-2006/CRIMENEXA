package com.xcom.crimenexa.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "case_records")
public class CaseRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "case_code", unique = true, nullable = false)
    private String caseCode;

    @Column(name = "operation_name", nullable = false)
    private String operationName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CaseStatus status;

    @Column(name = "officer_id", nullable = false)
    private UUID officerId;

    @Column(name = "officer_name", nullable = false)
    private String officerName;

    @Column(name = "entities_count")
    private int entitiesCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    @Column(name = "opened_date", nullable = false)
    private LocalDate openedDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public enum CaseStatus {
        ACTIVE, CLOSED
    }

    public enum Priority {
        CRITICAL, HIGH, MEDIUM, LOW
    }

    public CaseRecord() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
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

    public CaseStatus getStatus() {
        return status;
    }

    public void setStatus(CaseStatus status) {
        this.status = status;
    }

    public UUID getOfficerId() {
        return officerId;
    }

    public void setOfficerId(UUID officerId) {
        this.officerId = officerId;
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

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public LocalDate getOpenedDate() {
        return openedDate;
    }

    public void setOpenedDate(LocalDate openedDate) {
        this.openedDate = openedDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}