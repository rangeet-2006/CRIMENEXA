package com.xcom.crimenexa.repository;

import com.xcom.crimenexa.model.RevokedToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RevokedTokenRepository extends JpaRepository<RevokedToken, UUID> {
    Optional<RevokedToken> findByTokenHash(String tokenHash);
}