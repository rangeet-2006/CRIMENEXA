package com.xcom.crimenexa.controller;

import com.xcom.crimenexa.dto.UserProfileResponse;
import com.xcom.crimenexa.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(Authentication authentication) {
        String badgeId = authentication.getName();
        UserProfileResponse profile = userService.getProfileByBadgeId(badgeId);
        return ResponseEntity.ok(profile);
    }
}