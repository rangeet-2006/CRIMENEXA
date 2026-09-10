package com.xcom.crimenexa.service;

import com.xcom.crimenexa.dto.UserProfileResponse;
import com.xcom.crimenexa.exception.UserNotFoundException;
import com.xcom.crimenexa.model.User;
import com.xcom.crimenexa.repository.AuditLogRepository;
import com.xcom.crimenexa.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    public UserProfileResponse getProfileByBadgeId(String badgeId) {
        User user = userRepository.findByBadgeId(badgeId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        Instant lastLogin = auditLogRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .filter(log -> log.getAction().equals("LOGIN_SUCCESS"))
                .findFirst()
                .map(log -> log.getCreatedAt())
                .orElse(user.getCreatedAt());

        return new UserProfileResponse(
                user.getId().toString(),
                user.getBadgeId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                lastLogin
        );
    }
}