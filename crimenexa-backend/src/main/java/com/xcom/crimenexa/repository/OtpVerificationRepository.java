package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OtpVerificationRepository extends JpaRepository<OtpVerification, UUID> {
    Optional<OtpVerification> findByTempToken(String tempToken);
}