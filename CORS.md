# CORS between this frontend and the CRIMENEXA services

## What is actually wrong

Both services already have working CORS middleware. Neither is misconfigured in
the usual "wildcard plus credentials" way. The problem is narrower: **their
allowlists do not contain this app's origin.**

Measured against the live services:

| Origin | AI service | Backend |
| --- | --- | --- |
| `http://localhost:3000` | allowed | allowed |
| `http://localhost:5173` | rejected | allowed |
| `http://localhost:8443` (this dev server) | rejected | rejected |
| `https://example.com` | rejected | rejected |

Evidence:

- AI service preflight returns `400` with the body `Disallowed CORS origin`,
  which is Starlette's `CORSMiddleware` refusing an origin outside its list. It
  emits `access-control-allow-methods`, `allow-headers` and `max-age`, but omits
  `access-control-allow-origin`.
- Backend preflight returns `403` with `vary: Access-Control-Request-Method` and
  no `access-control-allow-origin`. Tellingly, `POST /api/auth/login {}` returns
  `400` (validation) with no `Origin` header but `403` with one, so Spring
  Security's CORS filter rejects the request before the validator ever runs.

`curl` and Postman never show this. Only browsers enforce CORS.

## Development: already handled, no service change needed

`vite.config.ts` proxies `/ai-api` and `/be-api` to the two services, and
`src/lib/config.ts` points at those prefixes when `import.meta.env.DEV` is true.
The browser talks same-origin to Vite; Vite makes the upstream call server-side,
where CORS does not apply. This works on any port, so it survives Figma Make
setting `$PORT`.

Verified working: `GET /ai-api/api/graph/{case}` returns 200 from the browser on
`localhost:8443`, and the network view renders live service data.

## Production: both services must be changed

The proxy only exists in the Vite dev server. A deployed build calls the
services directly, so **the deployed frontend's origin has to be added to both
allowlists.** Neither change is in this repo.

### AI service (FastAPI)

Find the existing `CORSMiddleware` registration and extend `allow_origins`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8443",
        "https://<your-deployed-frontend>",
    ],
    # Or, to stop chasing dev ports:
    #   allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Note: if you ever switch to `allow_origins=["*"]`, you must also set
`allow_credentials=False`. Starlette refuses to echo a wildcard origin alongside
credentials and silently drops the header, which produces exactly the symptom
this document describes.

### Backend (Spring Boot + Spring Security)

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration c = new CorsConfiguration();
    c.setAllowedOrigins(List.of(
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8443",
        "https://<your-deployed-frontend>"));
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    c.setAllowedHeaders(List.of("*"));
    c.setAllowCredentials(true);
    c.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/**", c);
    return src;
}
```

and make sure the security chain actually consults it:

```java
http.cors(Customizer.withDefaults())   // without this the bean is ignored
    .authorizeHttpRequests(a -> a
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers("/api/auth/**").permitAll()
        .anyRequest().authenticated());
```

`setAllowCredentials(true)` forbids `"*"` as an origin - list them explicitly, or
use `setAllowedOriginPatterns` if you need wildcards.

## How to verify a fix

```bash
curl -sS -o /dev/null -D - -X OPTIONS \
  -H "Origin: https://<your-deployed-frontend>" \
  -H "Access-Control-Request-Method: POST" \
  https://crimenexa-ai-service.onrender.com/api/geo/distance | grep -i access-control
```

A working config returns `200` and echoes
`access-control-allow-origin: https://<your-deployed-frontend>`. No
`allow-origin` line means the origin is still not on the list.
