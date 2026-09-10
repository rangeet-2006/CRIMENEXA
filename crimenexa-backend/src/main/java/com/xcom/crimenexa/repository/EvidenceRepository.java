package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.Evidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EvidenceRepository extends JpaRepository<Evidence, UUID> {
    List<Evidence> findByCaseIdOrderByUploadedAtDesc(UUID caseId);
    List<Evidence> findTop10ByOrderByUploadedAtDesc();
}