package com.xcom.crimenexa.security;

import com.xcom.crimenexa.model.User;
import com.xcom.crimenexa.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String badgeId) throws UsernameNotFoundException {
        User user = userRepository.findByBadgeId(badgeId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with badge ID: " + badgeId));

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getBadgeId())
                .password(user.getPasswordHash())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())))
                .build();
    }
}