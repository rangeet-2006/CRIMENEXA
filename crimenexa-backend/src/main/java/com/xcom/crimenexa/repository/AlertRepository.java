package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlertRepository extends JpaRepository<Alert, UUID> {
    List<Alert> findBySeverityOrderByCreatedAtDesc(Alert.Severity severity);
    List<Alert> findAllByOrderByCreatedAtDesc();
    List<Alert> findTop5ByOrderByCreatedAtDesc();
    long countBySeverity(Alert.Severity severity);

    /** Used to avoid raising the same finding twice when a case is re-analysed. */
    boolean existsByCaseIdAndTitle(UUID caseId, String title);
}