package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.CaseRequest;
import com.xcom.crimenexa.dto.CaseResponse;
import com.xcom.crimenexa.model.CaseRecord;
import com.xcom.crimenexa.model.User;
import com.xcom.crimenexa.repository.CaseRepository;
import com.xcom.crimenexa.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CaseService {

    @Autowired
    private CaseRepository caseRepository;

    @Autowired
    private UserRepository userRepository;

    public List<CaseResponse> getAllCases(String statusFilter, String search) {
        List<CaseRecord> cases;

        if (search != null && !search.isBlank()) {
            cases = caseRepository.findByOperationNameContainingIgnoreCase(search);
        } else if (statusFilter != null && !statusFilter.equalsIgnoreCase("ALL")) {
            cases = caseRepository.findByStatus(CaseRecord.CaseStatus.valueOf(statusFilter.toUpperCase()));
        } else {
            cases = caseRepository.findAll();
        }

        return cases.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public CaseResponse createCase(CaseRequest request, String officerBadgeId) {
        User officer = userRepository.findByBadgeId(officerBadgeId)
                .orElseThrow(() -> new RuntimeException("Officer not found"));

        CaseRecord caseRecord = new CaseRecord();
        caseRecord.setCaseCode(generateCaseCode());
        caseRecord.setOperationName(request.getOperationName());
        caseRecord.setStatus(CaseRecord.CaseStatus.ACTIVE);
        caseRecord.setOfficerId(officer.getId());
        caseRecord.setOfficerName(officer.getFullName());
        caseRecord.setEntitiesCount(0);
        caseRecord.setPriority(CaseRecord.Priority.valueOf(request.getPriority().toUpperCase()));
        caseRecord.setOpenedDate(request.getOpenedDate() != null ? request.getOpenedDate() : LocalDate.now());

        CaseRecord saved = caseRepository.save(caseRecord);
        return toResponse(saved);
    }

    public CaseResponse updateStatus(UUID caseId, String status) {
        CaseRecord caseRecord = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("Case not found"));
        caseRecord.setStatus(CaseRecord.CaseStatus.valueOf(status.toUpperCase()));
        CaseRecord saved = caseRepository.save(caseRecord);
        return toResponse(saved);
    }

    private String generateCaseCode() {
        int year = LocalDate.now().getYear();
        long count = caseRepository.count() + 1;
        return String.format("OPS-%d-%03d", year, count);
    }

    private CaseResponse toResponse(CaseRecord c) {
        return new CaseResponse(
                c.getId().toString(),
                c.getCaseCode(),
                c.getOperationName(),
                c.getStatus().name(),
                c.getOfficerName(),
                c.getEntitiesCount(),
                c.getPriority().name(),
                c.getOpenedDate()
        );
    }
}