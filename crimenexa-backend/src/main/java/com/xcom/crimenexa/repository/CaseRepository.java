package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.CaseRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CaseRepository extends JpaRepository<CaseRecord, UUID> {
    Optional<CaseRecord> findByCaseCode(String caseCode);
    List<CaseRecord> findByStatus(CaseRecord.CaseStatus status);
    List<CaseRecord> findByOperationNameContainingIgnoreCase(String search);
}