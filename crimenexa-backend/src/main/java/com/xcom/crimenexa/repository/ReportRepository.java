package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {
    List<Report> findByCaseIdOrderByGeneratedAtDesc(UUID caseId);
    List<Report> findAllByOrderByGeneratedAtDesc();
}