package com.xcom.crimenexa.service;

import com.xcom.crimenexa.config.JwtUtil;
import com.xcom.crimenexa.dto.*;
import com.xcom.crimenexa.exception.DuplicateUserException;
import com.xcom.crimenexa.exception.InvalidOtpException;
import com.xcom.crimenexa.exception.UserNotFoundException;
import com.xcom.crimenexa.model.OtpVerification;
import com.xcom.crimenexa.model.RevokedToken;
import com.xcom.crimenexa.model.User;
import com.xcom.crimenexa.repository.OtpVerificationRepository;
import com.xcom.crimenexa.repository.RevokedTokenRepository;
import com.xcom.crimenexa.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final long LOGOUT_BLACKLIST_TTL_MS = 900000;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    @Autowired
    private RevokedTokenRepository revokedTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EmailOtpService emailOtpService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private JwtUtil jwtUtil;

    public UserProfileResponse signup(SignupRequest request) {
        if (userRepository.findByBadgeId(request.getBadgeId()).isPresent()) {
            throw new DuplicateUserException("Badge ID already registered");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateUserException("Email already registered");
        }

        User user = new User();
        user.setBadgeId(request.getBadgeId());
        user.setEmail(request.getEmail());
        user.setFullName(request.getFullName());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(User.Role.valueOf(request.getRole().toUpperCase()));

        User saved = userRepository.save(user);

        return new UserProfileResponse(
                saved.getId().toString(),
                saved.getBadgeId(),
                saved.getFullName(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.getCreatedAt()
        );
    }

    public LoginResponse login(LoginRequest request, String ipAddress, String deviceInfo) {
        User user = userRepository.findByBadgeId(request.getBadgeId())
                .orElseThrow(() -> new UserNotFoundException("Invalid badge ID or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            auditLogService.log(user.getId(), "LOGIN_FAILED", ipAddress, deviceInfo);
            throw new UserNotFoundException("Invalid badge ID or password");
        }

        if (!user.getRole().name().equalsIgnoreCase(request.getAccessLevel())) {
            auditLogService.log(user.getId(), "LOGIN_FAILED_ROLE_MISMATCH", ipAddress, deviceInfo);
            throw new UserNotFoundException("Access level does not match this account");
        }

        String otp = generateOtp();
        String tempToken = UUID.randomUUID().toString();

        OtpVerification otpVerification = new OtpVerification();
        otpVerification.setUserId(user.getId());
        otpVerification.setTempToken(tempToken);
        otpVerification.setOtpHash(passwordEncoder.encode(otp));
        otpVerification.setAttempts(0);
        otpVerification.setExpiresAt(Instant.now().plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES));
        otpVerificationRepository.save(otpVerification);

        emailOtpService.sendOtp(user.getEmail(), otp);
        auditLogService.log(user.getId(), "OTP_SENT", ipAddress, deviceInfo);

        return new LoginResponse(tempToken, emailOtpService.maskEmail(user.getEmail()));
    }

    public AuthResponse verifyOtp(OtpVerifyRequest request, String ipAddress, String deviceInfo) {
        OtpVerification otpVerification = otpVerificationRepository.findByTempToken(request.getTempToken())
                .orElseThrow(() -> new InvalidOtpException("Invalid or expired session"));

        if (otpVerification.getExpiresAt().isBefore(Instant.now())) {
            otpVerificationRepository.delete(otpVerification);
            throw new InvalidOtpException("OTP has expired. Please login again.");
        }

        if (otpVerification.getAttempts() >= MAX_OTP_ATTEMPTS) {
            otpVerificationRepository.delete(otpVerification);
            throw new InvalidOtpException("Too many failed attempts. Please login again.");
        }

        if (!passwordEncoder.matches(request.getOtp(), otpVerification.getOtpHash())) {
            otpVerification.setAttempts(otpVerification.getAttempts() + 1);
            otpVerificationRepository.save(otpVerification);
            throw new InvalidOtpException("Incorrect OTP");
        }

        User user = userRepository.findById(otpVerification.getUserId())
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getBadgeId(), user.getRole().name());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getBadgeId());

        otpVerificationRepository.delete(otpVerification);
        auditLogService.log(user.getId(), "LOGIN_SUCCESS", ipAddress, deviceInfo);

        UserProfileResponse profile = new UserProfileResponse(
                user.getId().toString(),
                user.getBadgeId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                Instant.now()
        );

        return new AuthResponse(accessToken, refreshToken, profile);
    }

    public void logout(String token, UUID userId, String ipAddress, String deviceInfo) {
        RevokedToken revokedToken = new RevokedToken();
        revokedToken.setTokenHash(token);
        revokedToken.setExpiresAt(Instant.now().plusMillis(LOGOUT_BLACKLIST_TTL_MS));
        revokedTokenRepository.save(revokedToken);

        auditLogService.log(userId, "LOGOUT", ipAddress, deviceInfo);
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }
}